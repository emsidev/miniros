/** Production is always denied, even if the walkthrough flag is accidentally set. */
export function developmentSkeletonEnabled(
  environment: string | undefined,
  flag: string | undefined,
) {
  return environment === "development" && flag === "1";
}
