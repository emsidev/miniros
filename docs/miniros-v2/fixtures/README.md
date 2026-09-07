# Golden fixture: expected arithmetic

`golden-shift.json` is synthetic test input, not a production seed or live Bettercup pricing/recipe source. Unit and transaction values are deliberately simple enough for independent verification.

Four paid orders contain five items: two Ube Matchas (₱300), one Plain Matcha (₱120), one Ube Matcha (₱150) and one Cookie Cup (₱100). Gross is ₱670. Refunding the prepared ₱150 drink yields ₱520 net sales. Retained cash before the refund is ₱550, after it ₱400; manual digital receipts are ₱120. With ₱2,000 opening float, expected cash is ₱2,400. Actual cash ₱2,390 produces a ₱10 shortage.

Four Ube Matchas consume materials: two in order A, one refunded-but-prepared in C, and one remake. Two Plain Matchas consume materials: the paid B and complimentary D. Six total drinks use 24 g matcha, 900 ml milk, six cups/lids/straws; four Ube drinks use 120 g ube. The cookie cup consumes one pre-made portion, 80 g ice cream, one cup and one spoon. The milk spill uses 200 ml; restock adds 1,000 ml.

Expected balances: matcha 976 g; milk 9,900 ml; ube 2,880 g; cups 93; lids 94; straws 94; cookie portions 5; ice cream 920 g; spoons 19. Actual cups 92 produces a -1 variance. Expected stock is not overwritten by actual observations; uncounted actual values stay unverified.

Test separately: blank versus counted zero versus Not brought; prepared versus explicitly unprepared cancellation; amount/recipe version freezing; duplicate checkout and refund; insufficient stock; fixed-precision fractional units; pack conversions; malformed inputs; split tender balancing; negative cash paid-out policy; role/tenant boundaries. Use additional fixtures rather than changing these expected constants to match a bug.

The JSON lists business actions rather than prescribing exact production event schema. Adapt them to the shared versioned contracts, keeping stable IDs and an independently maintained expected result. Owner/staff names and venue text in automated test fixtures must remain synthetic.
