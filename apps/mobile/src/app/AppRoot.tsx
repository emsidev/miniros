import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

const C = {
  ink: "#111318",
  muted: "#5D626C",
  canvas: "#F5F5F5",
  surface: "#FFFFFF",
  border: "#D7D7D3",
  soft: "#E9E9E7",
  accent: "#D9FF35",
  success: "#166534",
  successBg: "#DCFCE7",
  warning: "#92400E",
  warningBg: "#FEF3C7",
  info: "#1D4ED8",
  infoBg: "#DBEAFE",
};

type Screen = "Today" | "Sell" | "Prep" | "Stock" | "Close";
type Product = { name: string; price: number; stock: number; color: string };

const products: Product[] = [
  { name: "Brown Butter Cookies", price: 160, stock: 18, color: "#D7A978" },
  { name: "Sea Salt Brownies", price: 180, stock: 12, color: "#674335" },
  { name: "Ube Basque Cheesecake", price: 240, stock: 6, color: "#B59BD7" },
  { name: "Lemon Loaf", price: 140, stock: 0, color: "#F4D46A" },
  { name: "Cold Brew", price: 120, stock: 24, color: "#8C6D52" },
  { name: "Matcha Latte", price: 170, stock: 9, color: "#9DBB83" },
];

const money = (value: number) => `₱${value.toLocaleString("en-PH")}`;

function Mark({ inverse = false }: { inverse?: boolean }) {
  return (
    <View style={[styles.mark, inverse && styles.markInverse]}>
      <Text style={[styles.markText, inverse && styles.markTextInverse]}>
        M
      </Text>
    </View>
  );
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: string;
  tone?: "neutral" | "success" | "warning" | "info";
}) {
  const toneStyles = {
    neutral: [styles.pillNeutral, styles.pillNeutralText],
    success: [styles.pillSuccess, styles.pillSuccessText],
    warning: [styles.pillWarning, styles.pillWarningText],
    info: [styles.pillInfo, styles.pillInfoText],
  } as const;
  return (
    <View style={[styles.pill, toneStyles[tone][0]]}>
      <Text style={[styles.pillText, toneStyles[tone][1]]}>{children}</Text>
    </View>
  );
}

function Button({
  children,
  onPress,
  secondary = false,
  disabled = false,
}: {
  children: string;
  onPress?: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          secondary && styles.buttonSecondaryText,
          disabled && styles.buttonDisabledText,
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

function Header({
  title,
  subtitle,
  dark = false,
}: {
  title: string;
  subtitle?: string;
  dark?: boolean;
}) {
  return (
    <View
      accessibilityLabel={title}
      style={[styles.header, dark && styles.headerDark]}
    >
      <View style={styles.headerIdentity}>
        <Mark inverse={dark} />
        <View>
          <Text style={[styles.wordmark, dark && styles.darkText]}>
            MINIROS
          </Text>
          {subtitle ? (
            <Text style={[styles.headerSubtitle, dark && styles.darkMuted]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.headerRight}>
        <View style={[styles.syncDot, dark && styles.syncDotDark]} />
        <Text style={[styles.syncText, dark && styles.darkMuted]}>Synced</Text>
      </View>
    </View>
  );
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionHeading}>{title}</Text>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : null}
    </View>
  );
}

function TodayScreen({ go }: { go: (screen: Screen | "Open") => void }) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Header title="Today" subtitle="Thursday, 14 November 2024" />
      <View style={styles.greeting}>
        <Text style={styles.kicker}>ASSIGNED SHIFT</Text>
        <Text style={styles.pageTitle}>Good morning, Kai.</Text>
        <Text style={styles.body}>
          Your shift is ready. Get the booth open, then let MINIROS keep the
          ledger.
        </Text>
      </View>
      <View style={styles.shiftCard}>
        <View style={styles.shiftCardTop}>
          <View>
            <Text style={styles.cardEyebrow}>SATURDAY MARKET</Text>
            <Text style={styles.cardTitle}>Makati Weekend Bazaar</Text>
            <Text style={styles.cardMeta}>11:00 AM – 8:00 PM · Booth B14</Text>
          </View>
          <Pill tone="info">Assigned</Pill>
        </View>
        <View style={styles.rule} />
        <View style={styles.shiftStats}>
          <View>
            <Text style={styles.statLabel}>Target</Text>
            <Text style={styles.statValue}>{money(12000)}</Text>
          </View>
          <View>
            <Text style={styles.statLabel}>Products</Text>
            <Text style={styles.statValue}>6</Text>
          </View>
          <View>
            <Text style={styles.statLabel}>Operators</Text>
            <Text style={styles.statValue}>2</Text>
          </View>
        </View>
        <Button onPress={() => go("Sell")}>Start opening check</Button>
      </View>
      <SectionTitle title="Before you sell" action="3 tasks" />
      <View style={styles.taskList}>
        <Task
          icon="01"
          title="Confirm opening cash"
          detail="₱3,000 float · Not started"
          onPress={() => go("Open")}
        />
        <Task
          icon="02"
          title="Check delivery count"
          detail="42 units expected · Ready"
          done
        />
        <Task
          icon="03"
          title="Open the booth"
          detail="Requires opening cash · Next"
          onPress={() => go("Sell")}
        />
      </View>
      <View style={styles.tip}>
        <Text style={styles.tipTitle}>Keep the decision visible</Text>
        <Text style={styles.tipText}>
          Every sale, stock movement, and cost rolls into the location profit
          after closeout.
        </Text>
      </View>
    </ScrollView>
  );
}

function Task({
  icon,
  title,
  detail,
  done,
  onPress,
}: {
  icon: string;
  title: string;
  detail: string;
  done?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.task}>
      <View style={[styles.taskIcon, done && styles.taskIconDone]}>
        <Text style={[styles.taskIconText, done && styles.taskIconTextDone]}>
          {done ? "✓" : icon}
        </Text>
      </View>
      <View style={styles.taskCopy}>
        <Text style={styles.taskTitle}>{title}</Text>
        <Text style={styles.taskDetail}>{detail}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function SellScreen() {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Product[]>([]);
  const filtered = products.filter((product) =>
    product.name.toLowerCase().includes(query.toLowerCase()),
  );
  const total = cart.reduce((sum, item) => sum + item.price, 0);
  const add = (product: Product) =>
    product.stock > 0 && setCart((items) => [...items, product]);
  return (
    <View style={styles.flex}>
      <View style={styles.posHeader}>
        <View style={styles.posHeaderTop}>
          <View style={styles.headerIdentity}>
            <Mark inverse />
            <View>
              <Text style={styles.posWordmark}>MINIROS POS</Text>
              <Text style={styles.posLocation}>
                Makati Weekend Bazaar · Booth B14
              </Text>
            </View>
          </View>
          <Pill tone="success">Open</Pill>
        </View>
        <View style={styles.posStats}>
          <Text style={styles.posStat}>0 sales</Text>
          <Text style={styles.posStat}>·</Text>
          <Text style={styles.posStat}>0 units</Text>
          <Text style={styles.posStat}>·</Text>
          <Text style={styles.posStat}>₱0 shift sales</Text>
        </View>
      </View>
      <ScrollView
        style={styles.posBody}
        contentContainerStyle={styles.posContent}
      >
        <Text style={styles.posTitle}>Start a sale</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search products"
          placeholderTextColor={C.muted}
          style={styles.search}
        />
        <View style={styles.categoryRow}>
          <Pill tone="info">All products</Pill>
          <View style={styles.category}>
            <Text style={styles.categoryText}>Bakes</Text>
          </View>
          <View style={styles.category}>
            <Text style={styles.categoryText}>Drinks</Text>
          </View>
        </View>
        <View style={styles.productGrid}>
          {filtered.map((product) => (
            <Pressable
              key={product.name}
              disabled={product.stock === 0}
              onPress={() => add(product)}
              style={[
                styles.product,
                product.stock === 0 && styles.productSoldOut,
              ]}
            >
              <View
                style={[
                  styles.productSwatch,
                  { backgroundColor: product.color },
                ]}
              />
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productPrice}>{money(product.price)}</Text>
              <Text
                style={[
                  styles.productStock,
                  product.stock === 0 && styles.soldOutText,
                ]}
              >
                {product.stock === 0
                  ? "Sold out"
                  : `${product.stock} available`}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      {cart.length > 0 ? (
        <View style={styles.cartBar}>
          <View>
            <Text style={styles.cartLabel}>
              {cart.length} item{cart.length > 1 ? "s" : ""}
            </Text>
            <Text style={styles.cartTotal}>{money(total)}</Text>
          </View>
          <Button onPress={() => {}}>Review order</Button>
        </View>
      ) : (
        <View style={styles.emptyCart}>
          <Text style={styles.emptyCartTitle}>Order is empty</Text>
          <Text style={styles.emptyCartText}>
            Tap a product to add it to this sale.
          </Text>
        </View>
      )}
    </View>
  );
}

function PrepScreen() {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Header title="Prep queue" subtitle="Production and handover" />
      <View style={styles.queueBanner}>
        <View>
          <Text style={styles.cardEyebrow}>NEXT PRODUCTION RUN</Text>
          <Text style={styles.queueTitle}>Brown Butter Cookies</Text>
          <Text style={styles.cardMeta}>12 trays · Due by 10:15 AM</Text>
        </View>
        <Pill tone="warning">In progress</Pill>
      </View>
      <SectionTitle title="Today’s queue" action="4 batches" />
      <View style={styles.taskList}>
        <Task
          icon="01"
          title="Brown Butter Cookies"
          detail="12 trays · 18 ready to sell"
        />
        <Task
          icon="02"
          title="Sea Salt Brownies"
          detail="8 trays · 12 ready to sell"
          done
        />
        <Task
          icon="03"
          title="Ube Basque Cheesecake"
          detail="6 cakes · 6 ready to sell"
          done
        />
        <Task
          icon="04"
          title="Cold Brew concentrate"
          detail="24 bottles · Handover pending"
        />
      </View>
      <SectionTitle title="Handover notes" />
      <View style={styles.note}>
        <Text style={styles.noteTitle}>Booth B14</Text>
        <Text style={styles.body}>
          Keep cheesecakes chilled. Count remaining units before the 2:00 PM
          stock check.
        </Text>
      </View>
    </ScrollView>
  );
}

function StockScreen() {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Header title="Stock" subtitle="Makati Weekend Bazaar" />
      <View style={styles.stockSummary}>
        <View>
          <Text style={styles.cardEyebrow}>SELLABLE UNITS</Text>
          <Text style={styles.bigNumber}>69</Text>
          <Text style={styles.cardMeta}>across 6 products</Text>
        </View>
        <Pill tone="success">Healthy</Pill>
      </View>
      <SectionTitle title="Sellable now" action="6 products" />
      <View style={styles.stockList}>
        {products.map((product) => (
          <View key={product.name} style={styles.stockRow}>
            <View
              style={[styles.stockDot, { backgroundColor: product.color }]}
            />
            <View style={styles.stockCopy}>
              <Text style={styles.taskTitle}>{product.name}</Text>
              <Text style={styles.taskDetail}>
                Unit price {money(product.price)}
              </Text>
            </View>
            <Text
              style={[
                styles.stockCount,
                product.stock === 0 && styles.soldOutText,
              ]}
            >
              {product.stock === 0 ? "Sold out" : product.stock}
            </Text>
          </View>
        ))}
      </View>
      <Button secondary onPress={() => {}}>
        Log stock movement
      </Button>
    </ScrollView>
  );
}

function CloseScreen() {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Header title="Closeout" subtitle="Makati Weekend Bazaar" />
      <View style={styles.closeBanner}>
        <Text style={styles.cardEyebrow}>SHIFT STATUS</Text>
        <Text style={styles.closeTitle}>Ready to close</Text>
        <Text style={styles.body}>
          No sales recorded yet. Complete the shift checklist before submitting
          closeout.
        </Text>
        <View style={styles.closeProgress}>
          <View style={styles.closeProgressFill} />
        </View>
        <Text style={styles.cardMeta}>2 of 5 closeout tasks complete</Text>
      </View>
      <SectionTitle title="Closeout checklist" />
      <View style={styles.taskList}>
        <Task
          icon="01"
          title="Count remaining stock"
          detail="69 units expected"
          done
        />
        <Task
          icon="02"
          title="Reconcile cash"
          detail="Opening float + sales"
          done
        />
        <Task
          icon="03"
          title="Record expenses"
          detail="Transport, rent, supplies"
        />
        <Task
          icon="04"
          title="Confirm payment proofs"
          detail="0 pending proofs"
        />
        <Task
          icon="05"
          title="Submit shift closeout"
          detail="Requires all tasks"
        />
      </View>
      <Button disabled>Submit closeout</Button>
    </ScrollView>
  );
}

function OpenScreen({ go }: { go: (screen: Screen) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Header title="Opening check" subtitle="Makati Weekend Bazaar" />
      <View style={styles.openHero}>
        <Text style={styles.cardEyebrow}>SHIFT START</Text>
        <Text style={styles.pageTitle}>Make the first count exact.</Text>
        <Text style={styles.body}>
          Confirm the float and delivery before opening the booth. This gives
          closeout a clean starting point.
        </Text>
      </View>
      <View style={styles.formCard}>
        <Text style={styles.fieldLabel}>Opening cash</Text>
        <TextInput
          keyboardType="number-pad"
          defaultValue="3000"
          style={styles.amountInput}
        />
        <Text style={styles.fieldHint}>Expected float · ₱3,000</Text>
        <View style={styles.rule} />
        <Text style={styles.fieldLabel}>Delivery count</Text>
        <Text style={styles.amountInputText}>42 units</Text>
        <Text style={styles.fieldHint}>Matches the expected handover</Text>
      </View>
      <Button onPress={() => go("Sell")}>Confirm and open shift</Button>
      <Button secondary onPress={() => go("Today")}>
        Back to shift
      </Button>
    </ScrollView>
  );
}

export function AppRoot() {
  const [screen, setScreen] = useState<Screen | "Open">("Today");
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const nav = useMemo(
    () => ["Today", "Sell", "Prep", "Stock", "Close"] as Screen[],
    [],
  );
  const go = (next: Screen | "Open") => setScreen(next);
  const content =
    screen === "Today" ? (
      <TodayScreen go={go} />
    ) : screen === "Sell" ? (
      <SellScreen />
    ) : screen === "Prep" ? (
      <PrepScreen />
    ) : screen === "Stock" ? (
      <StockScreen />
    ) : screen === "Close" ? (
      <CloseScreen />
    ) : (
      <OpenScreen go={go} />
    );
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={screen === "Sell" ? "light" : "dark"} />
      <View style={[styles.app, !compact && styles.appWide]}>
        <View style={styles.main}>{content}</View>
        {screen !== "Open" ? (
          <View style={[styles.bottomNav, !compact && styles.bottomNavWide]}>
            {nav.map((item) => (
              <Pressable
                key={item}
                accessibilityRole="tab"
                accessibilityState={{ selected: screen === item }}
                onPress={() => go(item)}
                style={[
                  styles.navItem,
                  screen === item && styles.navItemActive,
                ]}
              >
                <Text
                  style={[
                    styles.navGlyph,
                    screen === item && styles.navGlyphActive,
                  ]}
                >
                  {item === "Today"
                    ? "⌂"
                    : item === "Sell"
                      ? "＋"
                      : item === "Prep"
                        ? "≡"
                        : item === "Stock"
                          ? "▦"
                          : "✓"}
                </Text>
                <Text
                  style={[
                    styles.navLabel,
                    screen === item && styles.navLabelActive,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas },
  app: { flex: 1, backgroundColor: C.canvas },
  appWide: {
    maxWidth: 1180,
    alignSelf: "center",
    width: "100%",
    flexDirection: "row",
  },
  main: { flex: 1 },
  flex: { flex: 1, backgroundColor: C.canvas },
  content: { padding: 20, gap: 20, paddingBottom: 32 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 4,
  },
  headerDark: { backgroundColor: C.ink },
  headerIdentity: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  markInverse: { backgroundColor: C.accent },
  markText: { color: C.accent, fontSize: 20, fontWeight: "900" },
  markTextInverse: { color: C.ink },
  wordmark: { color: C.ink, fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  headerSubtitle: { color: C.muted, fontSize: 12, marginTop: 2 },
  headerRight: { flexDirection: "row", gap: 6, alignItems: "center" },
  syncDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.success },
  syncDotDark: { backgroundColor: C.accent },
  syncText: { color: C.muted, fontSize: 12, fontWeight: "700" },
  darkText: { color: C.surface },
  darkMuted: { color: C.soft },
  greeting: { gap: 8 },
  kicker: { color: C.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  pageTitle: {
    color: C.ink,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  body: { color: C.muted, fontSize: 15, lineHeight: 23 },
  shiftCard: { backgroundColor: C.ink, borderRadius: 14, padding: 20, gap: 18 },
  shiftCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  cardEyebrow: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  cardTitle: {
    color: C.surface,
    fontSize: 21,
    fontWeight: "800",
    marginTop: 5,
  },
  cardMeta: { color: C.muted, fontSize: 13, marginTop: 5 },
  rule: { height: 1, backgroundColor: C.border },
  shiftStats: { flexDirection: "row", justifyContent: "space-between" },
  statLabel: { color: C.soft, fontSize: 12 },
  statValue: {
    color: C.surface,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 3,
  },
  sectionTitle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  sectionHeading: { color: C.ink, fontSize: 18, fontWeight: "800" },
  sectionAction: { color: C.muted, fontSize: 13, fontWeight: "700" },
  taskList: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  task: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    minHeight: 72,
  },
  taskIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  taskIconDone: { backgroundColor: C.successBg },
  taskIconText: { color: C.muted, fontSize: 11, fontWeight: "900" },
  taskIconTextDone: { color: C.success, fontSize: 16 },
  taskCopy: { flex: 1, gap: 3 },
  taskTitle: { color: C.ink, fontSize: 15, fontWeight: "800" },
  taskDetail: { color: C.muted, fontSize: 13 },
  chevron: { color: C.muted, fontSize: 26, fontWeight: "300" },
  tip: { padding: 16, backgroundColor: C.infoBg, borderRadius: 10, gap: 5 },
  tipTitle: { color: C.info, fontSize: 14, fontWeight: "800" },
  tipText: { color: C.info, fontSize: 13, lineHeight: 20 },
  button: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: C.ink, fontSize: 14, fontWeight: "900" },
  buttonSecondary: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  buttonSecondaryText: { color: C.ink },
  buttonDisabled: { backgroundColor: C.soft },
  buttonDisabledText: { color: C.muted },
  buttonPressed: { opacity: 0.75 },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: { fontSize: 12, fontWeight: "800" },
  pillNeutral: { backgroundColor: C.soft },
  pillNeutralText: { color: C.muted },
  pillSuccess: { backgroundColor: C.successBg },
  pillSuccessText: { color: C.success },
  pillWarning: { backgroundColor: C.warningBg },
  pillWarningText: { color: C.warning },
  pillInfo: { backgroundColor: C.infoBg },
  pillInfoText: { color: C.info },
  posHeader: {
    backgroundColor: C.ink,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 14,
  },
  posHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  posWordmark: {
    color: C.surface,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  posLocation: { color: C.soft, fontSize: 12, marginTop: 2 },
  posStats: { flexDirection: "row", gap: 8, alignItems: "center" },
  posStat: { color: C.soft, fontSize: 12, fontWeight: "700" },
  posBody: { flex: 1 },
  posContent: { padding: 20, gap: 16, paddingBottom: 120 },
  posTitle: { color: C.ink, fontSize: 24, fontWeight: "900" },
  search: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    height: 46,
    paddingHorizontal: 14,
    color: C.ink,
    fontSize: 15,
  },
  categoryRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  category: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  categoryText: { color: C.muted, fontSize: 13, fontWeight: "700" },
  productGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  product: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 12,
    width: "48.2%",
    minHeight: 174,
    gap: 6,
  },
  productSoldOut: { opacity: 0.55 },
  productSwatch: { height: 62, borderRadius: 9, marginBottom: 4 },
  productName: {
    color: C.ink,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
  },
  productPrice: { color: C.ink, fontSize: 16, fontWeight: "900" },
  productStock: { color: C.success, fontSize: 12, fontWeight: "700" },
  soldOutText: { color: C.muted },
  emptyCart: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderColor: C.border,
    padding: 16,
    alignItems: "center",
    gap: 3,
  },
  emptyCartTitle: { color: C.ink, fontSize: 14, fontWeight: "800" },
  emptyCartText: { color: C.muted, fontSize: 12 },
  cartBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.ink,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cartLabel: { color: C.soft, fontSize: 12 },
  cartTotal: {
    color: C.surface,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 2,
  },
  queueBanner: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  queueTitle: { color: C.ink, fontSize: 21, fontWeight: "900", marginTop: 6 },
  note: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 8,
  },
  noteTitle: { color: C.ink, fontSize: 15, fontWeight: "800" },
  stockSummary: {
    backgroundColor: C.ink,
    borderRadius: 14,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bigNumber: {
    color: C.accent,
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -2,
    marginTop: 4,
  },
  stockList: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  stockDot: { width: 12, height: 12, borderRadius: 6 },
  stockCopy: { flex: 1, gap: 3 },
  stockCount: { color: C.ink, fontSize: 18, fontWeight: "900" },
  closeBanner: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 18,
    gap: 10,
  },
  closeTitle: { color: C.ink, fontSize: 25, fontWeight: "900" },
  closeProgress: {
    height: 8,
    backgroundColor: C.soft,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 5,
  },
  closeProgressFill: {
    height: "100%",
    width: "40%",
    backgroundColor: C.accent,
  },
  openHero: { gap: 8, paddingVertical: 8 },
  formCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    gap: 8,
  },
  fieldLabel: { color: C.ink, fontSize: 14, fontWeight: "800" },
  amountInput: {
    color: C.ink,
    fontSize: 30,
    fontWeight: "900",
    height: 54,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  amountInputText: {
    color: C.ink,
    fontSize: 30,
    fontWeight: "900",
    paddingVertical: 8,
  },
  fieldHint: { color: C.muted, fontSize: 13 },
  bottomNav: {
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 8,
    paddingBottom: 8,
  },
  bottomNavWide: {
    width: 180,
    flexDirection: "column",
    justifyContent: "flex-start",
    gap: 6,
    padding: 12,
    borderTopWidth: 0,
    borderLeftWidth: 1,
    borderLeftColor: C.border,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    minWidth: 58,
    minHeight: 48,
    borderRadius: 10,
  },
  navItemActive: { backgroundColor: C.ink },
  navGlyph: { color: C.muted, fontSize: 20, lineHeight: 22 },
  navGlyphActive: { color: C.accent },
  navLabel: { color: C.muted, fontSize: 11, fontWeight: "800" },
  navLabelActive: { color: C.surface },
});
