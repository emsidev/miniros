import { StatusBar } from "expo-status-bar";
import { ScrollView, Text, View } from "react-native";
import { workflowCatalog } from "@miniros/domain";
import { brandIdentity, brandTokens, heroCopy } from "@miniros/ui";

export function AppRoot() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: brandTokens.colors.canvas }}
      contentContainerStyle={{ padding: 24, gap: 16 }}
    >
      <StatusBar style="dark" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: brandIdentity.mark.primary.background,
          }}
        >
          <Text
            style={{
              color: brandIdentity.mark.primary.foreground,
              fontSize: 20,
              fontWeight: "800",
            }}
          >
            {brandIdentity.mark.geometry}
          </Text>
        </View>
        <View>
          <Text style={{ color: brandTokens.colors.ink, fontWeight: "800" }}>
            {brandIdentity.name}
          </Text>
          <Text
            style={{
              color: brandTokens.colors.mutedForeground,
              fontSize: 12,
            }}
          >
            {heroCopy.eyebrow}
          </Text>
        </View>
      </View>
      <Text
        style={{
          fontSize: 34,
          fontWeight: "800",
          color: brandTokens.colors.ink,
        }}
      >
        {heroCopy.headline}
      </Text>
      <Text
        style={{
          fontSize: 16,
          lineHeight: 24,
          color: brandTokens.colors.mutedForeground,
        }}
      >
        {heroCopy.description}
      </Text>
      {workflowCatalog.map((workflow) => (
        <View
          key={workflow.id}
          style={{
            borderRadius: 14,
            padding: 16,
            backgroundColor: brandTokens.colors.surface,
            borderWidth: 1,
            borderColor: brandTokens.colors.border,
          }}
        >
          <Text style={{ color: brandTokens.colors.ink, fontWeight: "700" }}>
            {workflow.owner}
          </Text>
          <Text
            style={{
              marginTop: 6,
              fontSize: 18,
              fontWeight: "700",
              color: brandTokens.colors.ink,
            }}
          >
            {workflow.label}
          </Text>
          <Text
            style={{
              marginTop: 6,
              color: brandTokens.colors.mutedForeground,
            }}
          >
            {workflow.ruleModules.join(" · ")}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
