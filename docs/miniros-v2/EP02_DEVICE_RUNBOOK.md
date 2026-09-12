# EP02 physical acceptance runbook

This is a procedure, not physical evidence. Source baseline: local `dev` at
`0056f316cf811f10f943d56c4c987b1642844938` plus this run's local changes.
The Nearby candidate is provisional. G1 remains blocked until the matrix below
has installed native builds, actual measurements, and independent security review.

## Build and installation

From the nested project root:

```sh
corepack pnpm --filter @miniros/mobile native:check:android
corepack pnpm --filter @miniros/mobile native:check:ios
corepack pnpm --filter @miniros/mobile native:prebuild
corepack pnpm --filter @miniros/mobile native:android
corepack pnpm --filter @miniros/mobile native:ios
```

The checks return exit 2 when prerequisites are missing. Android requires a JDK,
Android SDK and a connected authorized phone. iOS requires full Xcode, CocoaPods,
the candidate's resolved Swift package, signing, and an authorized iPhone. Expo Go
does not contain this native module. A web export or simulator is not device proof.
Use the development spike only with its synthetic shift identities; do not enter
customer information. Native build scripts opt into the development spike.

Before each run record device model/OS, roles, source diff checksum, native build,
protocol, permissions, battery/storage condition, radios, WAN route and local
environment. Keep payloads, capabilities and short codes out of shared logs.

## Required matrix

| Cashier | Prep    | Current result | Missing evidence                                              |
| ------- | ------- | -------------- | ------------------------------------------------------------- |
| Android | Android | BLOCKED        | Two phones, native toolchain/build, permissions, measured run |
| iPhone  | iPhone  | BLOCKED        | Two phones, native toolchain/build, signing, measured run     |
| Android | iPhone  | BLOCKED        | Both native builds/phones, signing, mixed-role measured run   |
| iPhone  | Android | BLOCKED        | Both native builds/phones, signing, reverse-role measured run |

For **each** row:

1. Disable internet separately: disable cellular data and disconnect any WAN uplink
   while retaining the local Wi-Fi/Bluetooth radios required by Nearby. Record how
   WAN absence was checked. Turning every radio off is a separate failure case.
2. Pair through the explicit matching verification code and the configured same-shift
   binding. Reject a different shift, mismatched code and a second nearby peer.
   Cancel discovery and confirm it stops before attempting a fresh connection.
3. Send 100 numbered orders and return status commands. Compare sender pending work
   with the receiver's durable inbox, including after both apps are terminated and
   reopened. Transport send success must not be labeled receiver receipt.
4. Lose an acknowledgement after receiver commit, resend, and verify one logical
   inbox operation, original receipt and no duplicate alert. Repeat at least 20
   disconnect/duplicate/lost-ack cycles. Portable fault injection is supporting I
   evidence; explicitly distinguish it from a physically observed drop.
5. Disable local radio, background/lock, reopen and restore radio. Pending work must
   remain visible and catch up after both phones return to an operational state.
   Kill immediately before and after persistence. Confirm no false received state.
6. Deny then grant Bluetooth/local-network permissions. Check actionable error and
   recovery without reset/reinstall. Camera denial applies when using camera pairing;
   manual short-code pairing does not establish camera evidence.
7. Check malformed, oversized, reordered and foreign-shift packets; preserve rejected
   evidence and bounded behavior without a false high-water mark.
8. Record actual sample size, p95/max durable receipt latency and catch-up duration.
   Compare against proposed 1s foreground receipt and 10s small-batch catch-up targets.
   Record accepted payload maximum and every failure. Do not replace these fields
   with portable timing or a simulator result.

Map observations to EP02-T01–T06 in EP02_EVIDENCE.md. Attach redacted run artifacts
and checksums. Missing cases retain BLOCKED/NOT RUN. Keep the transport provisional
until the independent reviewer accepts the physical/security evidence.
