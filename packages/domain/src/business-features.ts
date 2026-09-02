export const businessFeatureKeys = [
  "recipes",
  "production",
  "approvals",
  "promos",
] as const;

export type BusinessFeatureKey = (typeof businessFeatureKeys)[number];

export type BusinessFeatureFlags = Readonly<{
  recipesEnabled: boolean;
  productionEnabled: boolean;
  approvalsEnabled: boolean;
  promosEnabled: boolean;
}>;

export const defaultBusinessFeatureFlags: BusinessFeatureFlags = {
  recipesEnabled: true,
  productionEnabled: true,
  approvalsEnabled: true,
  promosEnabled: true,
};

const featureFlagByKey: Record<BusinessFeatureKey, keyof BusinessFeatureFlags> =
  {
    recipes: "recipesEnabled",
    production: "productionEnabled",
    approvals: "approvalsEnabled",
    promos: "promosEnabled",
  };

export function isBusinessFeatureEnabled(
  features: BusinessFeatureFlags,
  feature: BusinessFeatureKey,
) {
  return features[featureFlagByKey[feature]];
}

export function validateBusinessFeatureFlags(
  features: BusinessFeatureFlags,
): BusinessFeatureFlags {
  if (features.productionEnabled && !features.recipesEnabled) {
    throw new Error("Production requires the Recipe feature to be enabled.");
  }

  return features;
}
