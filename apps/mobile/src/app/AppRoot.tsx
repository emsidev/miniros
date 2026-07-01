import { StatusBar } from "expo-status-bar";
import { ScrollView, Text, View } from "react-native";
import { workflowCatalog } from "@miniros/domain";
import { heroCopy } from "@miniros/ui";

export function AppRoot() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#f8fafc" }}
      contentContainerStyle={{ padding: 24, gap: 16 }}
    >
      <StatusBar style="dark" />
      <Text style={{ color: "#0ea5e9", fontWeight: "700" }}>
        {heroCopy.eyebrow}
      </Text>
      <Text style={{ fontSize: 34, fontWeight: "800", color: "#0f172a" }}>
        {heroCopy.headline}
      </Text>
      <Text style={{ fontSize: 16, lineHeight: 24, color: "#334155" }}>
        {heroCopy.description}
      </Text>
      {workflowCatalog.map((workflow) => (
        <View
          key={workflow.id}
          style={{
            borderRadius: 18,
            padding: 16,
            backgroundColor: "#ffffff",
            borderWidth: 1,
            borderColor: "#cbd5e1",
          }}
        >
          <Text style={{ color: "#0ea5e9", fontWeight: "700" }}>
            {workflow.owner}
          </Text>
          <Text
            style={{
              marginTop: 6,
              fontSize: 18,
              fontWeight: "700",
              color: "#0f172a",
            }}
          >
            {workflow.label}
          </Text>
          <Text style={{ marginTop: 6, color: "#475569" }}>
            {workflow.ruleModules.join(" · ")}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
