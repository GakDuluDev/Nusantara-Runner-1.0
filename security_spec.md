# Security Specification: Nusantara English Dash

## 1. Data Invariants
1. **Strict Ownership**: A player can only create or update the `/leaderboard/{userId}` document where `userId == request.auth.uid` and `data.uid == request.auth.uid`.
2. **Monotonic High Score**: Once created, a player's `highScore` cannot decrease on update (`incoming().highScore >= existing().highScore`).
3. **Zero PII Exposure**: No email address, phone number, or physical address is stored in `/leaderboard/{userId}` so that signed-in players can safely view the Top 10 leaderboard.
4. **Strict Schema & Bounds**: All documents must contain exact required keys (`hasAll` + `hasOnly`), bounded strings (`displayName` 1..32 chars), and bounded numeric values (`highScore` 0..10000000, `levelReached` 1..3).
5. **Server Timestamp Integrity**: `updatedAt` must strictly equal `request.time`.

## 2. Adversarial Payloads ("Dirty Dozen")
1. Unauthenticated read/write to `/leaderboard/{userId}` -> `PERMISSION_DENIED`.
2. Creating `/leaderboard/{otherUid}` with `request.auth.uid != otherUid` -> `PERMISSION_DENIED`.
3. Creating `/leaderboard/{uid}` with `data.uid != request.auth.uid` -> `PERMISSION_DENIED`.
4. Injecting a ghost field `isAdmin: true` or `email: "a@b.com"` -> `PERMISSION_DENIED`.
5. Oversized `displayName` (> 32 chars) or empty string (`""`) -> `PERMISSION_DENIED`.
6. Oversized `userId` document ID (> 128 chars or invalid chars) -> `PERMISSION_DENIED`.
7. Negative `highScore: -50` or absurd `highScore: 999999999` -> `PERMISSION_DENIED`.
8. Decreasing `highScore` on update (`incoming().highScore < existing().highScore`) -> `PERMISSION_DENIED`.
9. Spoofing client timestamp (`updatedAt: "2026-01-01"`) instead of `request.time` -> `PERMISSION_DENIED`.
10. Mutating immutable `uid` during update -> `PERMISSION_DENIED`.
11. Invalid `levelReached: 99` outside `1..3` -> `PERMISSION_DENIED`.
12. Deleting another player's leaderboard entry (or any entry) -> `PERMISSION_DENIED`.
