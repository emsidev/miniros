import { useEffect, useRef, useState } from "react";
import {
  AppState,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { brandIdentity, brandTokens, designTokens } from "@miniros/ui";
import { createNativeSpike, hash } from "./native-runtime";
import { makeEnvelope, type Role } from "./protocol";
import type { SessionState } from "./session";
const colors = brandTokens.colors;
type Runtime = Awaited<ReturnType<typeof createNativeSpike>>;
const initial: SessionState = {
  phase: "idle",
  message:
    "Choose a different role on each phone and enter the same test group.",
  peers: [],
  challenge: null,
};
export function PeerSpikeScreen() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <SpikeControls />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
function SpikeControls() {
  const [role, setRole] = useState<Role>("cashier");
  const [group, setGroup] = useState("ep02-test-1");
  const [code, setCode] = useState("");
  const [state, setState] = useState(initial);
  const [stats, setStats] = useState({ saved: 0, received: 0, pending: 0 });
  const [error, setError] = useState("");
  const [measurements, setMeasurements] = useState<{
    sampleSize: number;
    p95Ms: number | null;
    maxMs: number | null;
  }>({ sampleSize: 0, p95Ms: null, maxMs: null });
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const runtime = useRef<Runtime | null>(null);
  const unlisten = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  const actionBusy = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const listener = AppState.addEventListener("change", (next) => {
      if (next !== "active")
        void runtime.current?.session.stop(true).catch(() => {
          if (mounted.current)
            setError(
              "Could not finish pausing the link. Reopen and reconnect before continuing.",
            );
        });
    });
    return () => {
      mounted.current = false;
      listener.remove();
      unlisten.current?.();
      void runtime.current?.close().catch(() => {});
    };
  }, []);
  async function action(work: () => Promise<void>) {
    if (actionBusy.current) return;
    actionBusy.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (error) {
      if (mounted.current)
        setError(
          error instanceof Error
            ? error.message
            : "The action could not finish. Your last saved tests remain on this phone.",
        );
    } finally {
      actionBusy.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function prepare() {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/.test(group.trim()))
      throw new Error(
        "Use 1–64 letters, numbers, dashes or dots for the test group.",
      );
    const created = await createNativeSpike(role, group.trim());
    if (!mounted.current) {
      await created.close();
      return;
    }
    runtime.current = created;
    const refresh = () => {
      if (!mounted.current) return;
      setState(created.session.state);
      setMeasurements(created.session.measurements());
      void created.session.store
        .stats()
        .then((value) => {
          if (mounted.current) setStats(value);
        })
        .catch(() => {
          if (mounted.current)
            setError(
              "Could not read saved-test totals. Reopen the test before sending more.",
            );
        });
    };
    unlisten.current = created.session.subscribe(refresh);
    refresh();
    setReady(true);
    await created.session.start();
  }
  async function sendBatch(count: number) {
    const current = runtime.current;
    if (!current) return;
    for (let i = 0; i < count; i++) {
      const { nextSequence } = await current.session.store.stats();
      const envelope = await makeEnvelope(
        current.session.store.scope,
        {
          messageId: `${role}-${nextSequence}`,
          sequence: nextSequence,
          number: nextSequence,
          text:
            role === "cashier"
              ? "Synthetic order: one test drink"
              : "Synthetic prep command: test drink done",
        },
        hash,
      );
      await current.session.save(envelope);
    }
  }
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.identity}>
          <View accessible={false} style={styles.mark}>
            <Text style={styles.markText}>{brandIdentity.mark.geometry}</Text>
          </View>
          <Text style={styles.brand}>{brandIdentity.name}</Text>
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          Two-phone test
        </Text>
        <Text style={styles.body}>
          Native development spike · synthetic data only
        </Text>
        <Text style={styles.help}>
          Use two installed test builds. Turn off internet while keeping local
          radios available. This test does not create sales or enroll staff.
        </Text>
        {!ready ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.heading}>
              This phone’s role
            </Text>
            <View style={styles.roleRow}>
              {(["cashier", "prep"] as const).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: role === value,
                    disabled: busy,
                  }}
                  disabled={busy}
                  onPress={() => setRole(value)}
                  style={({ pressed }) => [
                    styles.role,
                    role === value && styles.roleSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      role === value && styles.selectedText,
                    ]}
                  >
                    {value === "cashier" ? "Cashier" : "Prep"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text nativeID="test-group-label" style={styles.label}>
              Test group
            </Text>
            <TextInput
              accessibilityLabel="Test group"
              accessibilityLabelledBy="test-group-label"
              value={group}
              onChangeText={setGroup}
              editable={!busy}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="none"
              maxLength={64}
              style={styles.input}
            />
            <Text style={styles.help}>
              Enter the same group on both phones. Reuse it after reopening to
              restore its saved tests.
            </Text>
            <Button
              label={busy ? "Preparing…" : "Prepare test phone"}
              disabled={busy}
              onPress={() => void action(prepare)}
              primary
            />
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.heading}>
                {role === "cashier" ? "Cashier phone" : "Prep phone"} · {group}
              </Text>
              <Text accessibilityLiveRegion="polite" style={styles.body}>
                {state.message}
              </Text>
              {state.challenge && (
                <View style={styles.compare}>
                  <Text style={styles.label}>Code on this phone</Text>
                  <Text
                    accessibilityLabel={`Pairing code ${state.challenge.code.split("").join(" ")}`}
                    selectable
                    style={styles.code}
                  >
                    {state.challenge.code}
                  </Text>
                  <Text style={styles.help}>
                    Read the code shown on the other phone. Enter it here only
                    if the codes match.
                  </Text>
                  <TextInput
                    accessibilityLabel="Code from the other phone"
                    value={code}
                    onChangeText={setCode}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    textContentType="none"
                    maxLength={12}
                    style={styles.input}
                  />
                  <Button
                    primary
                    label="Confirm matching codes"
                    disabled={busy || code.trim().length < 4}
                    onPress={() =>
                      void action(async () => {
                        await runtime.current?.session.confirm(code);
                        setCode("");
                      })
                    }
                  />
                  <View style={styles.cancelSeparation}>
                    <Button
                      label="Cancel pairing"
                      disabled={busy}
                      onPress={() =>
                        void action(async () => {
                          await runtime.current?.session.cancelPairing();
                          setCode("");
                        })
                      }
                    />
                  </View>
                </View>
              )}
              {state.peers.map((peer, index) => (
                <Button
                  key={peer}
                  label={`Connect test phone ${index + 1}`}
                  primary
                  disabled={busy}
                  onPress={() =>
                    void action(async () => {
                      await runtime.current?.session.connect(peer);
                    })
                  }
                />
              ))}
              {!state.challenge && state.phase !== "connected" && (
                <Button
                  label={
                    state.phase === "discovering"
                      ? "Restart search"
                      : "Reconnect phones"
                  }
                  disabled={busy}
                  onPress={() =>
                    void action(async () => {
                      await runtime.current?.session.start();
                    })
                  }
                />
              )}
              {(state.phase === "connected" ||
                state.phase === "discovering") && (
                <Button
                  label="Disconnect"
                  disabled={busy}
                  onPress={() =>
                    void action(async () => {
                      await runtime.current?.session.stop();
                    })
                  }
                />
              )}
            </View>
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.heading}>
                Saved-test record
              </Text>
              <Text style={styles.body}>Saved here: {stats.saved}</Text>
              <Text style={styles.body}>
                Confirmed saved on other phone: {stats.saved - stats.pending}
              </Text>
              <Text style={styles.body}>
                Waiting for receipt: {stats.pending}
              </Text>
              <Text style={styles.body}>
                Received and saved here: {stats.received}
              </Text>
              <Text selectable style={styles.help}>
                This run: {measurements.sampleSize} timed receipts · p95{" "}
                {measurements.p95Ms === null
                  ? "not measured"
                  : `${Math.round(measurements.p95Ms)} ms`}{" "}
                · max{" "}
                {measurements.maxMs === null
                  ? "not measured"
                  : `${Math.round(measurements.maxMs)} ms`}
                . Timings restart when this screen is reopened; record the
                phone, radios and test conditions separately.
              </Text>
              <Text style={styles.help}>
                A radio connection alone does not count as received. You can
                save tests while disconnected and retry after pairing.
              </Text>
              <Button
                primary
                label={busy ? "Working…" : "Save and send one test"}
                disabled={busy}
                onPress={() => void action(() => sendBatch(1))}
              />
              <Button
                label="Save 100 numbered tests"
                disabled={busy}
                onPress={() => void action(() => sendBatch(100))}
              />
              <Button
                label="Retry saved tests"
                disabled={
                  busy || state.phase !== "connected" || stats.pending === 0
                }
                onPress={() =>
                  void action(async () => {
                    await runtime.current?.session.flush();
                  })
                }
              />
            </View>
          </>
        )}
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Button
          label="Open app permissions"
          disabled={busy}
          onPress={() => void action(() => Linking.openSettings())}
        />
        <Text style={styles.help}>
          Keep both phones open during the test. Locking or backgrounding pauses
          delivery. Camera scanning is not part of this manual-code spike.
          Physical compatibility and speed have not been verified.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
function Button({
  label,
  onPress,
  disabled,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.primary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, primary && styles.selectedText]}>
        {label}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 24, paddingBottom: 32, gap: 16 },
  identity: { flexDirection: "row", alignItems: "center", gap: 12 },
  mark: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,
  },
  markText: { color: colors.accent, fontWeight: "800", fontSize: 20 },
  brand: { color: colors.ink, fontWeight: "800", fontSize: 18 },
  title: { color: colors.ink, fontSize: 30, fontWeight: "800" },
  heading: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  body: { color: colors.ink, fontSize: 17, lineHeight: 25 },
  help: { color: colors.mutedForeground, fontSize: 15, lineHeight: 23 },
  label: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  section: {
    gap: 12,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  roleRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  role: {
    minHeight: 48,
    padding: 14,
    flexGrow: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  roleSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  input: {
    minHeight: 52,
    padding: 14,
    fontSize: 17,
    borderWidth: 1,
    borderColor: colors.mutedForeground,
    borderRadius: 10,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  button: {
    minHeight: 52,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.ink, borderColor: colors.ink },
  buttonText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  selectedText: { color: colors.surface },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
  compare: { gap: 12 },
  cancelSeparation: { marginTop: 24 },
  code: {
    fontSize: 36,
    fontWeight: "700",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  error: {
    color: designTokens.colors.dangerForeground,
    backgroundColor: designTokens.colors.dangerSurface,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    padding: 16,
    borderWidth: 1,
    borderColor: designTokens.colors.dangerForeground,
    borderRadius: 10,
  },
});
