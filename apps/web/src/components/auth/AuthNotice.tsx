export function AuthNotice() {
  return (
    <section
      style={{
        marginTop: "2rem",
        padding: "1rem 1.25rem",
        borderRadius: "1rem",
        background: "#e0f2fe",
        color: "#0f172a",
      }}
    >
      Auth flows stay in the web app. Public marketing content stays in
      `apps/site`, and typed workflow mutations move through `apps/api`.
    </section>
  );
}
