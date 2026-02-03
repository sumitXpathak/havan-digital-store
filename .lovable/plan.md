
# Fix Admin Access with Clerk Authentication

## Problem Identified

The admin panel shows "Access Denied" because there's a fundamental mismatch between the authentication system and the database security setup:

1. **Your app uses Clerk** for authentication (user IDs like `user_394ojzQGIrkwkvHPjt79momfIX2`)
2. **Database policies use `auth.uid()`** which only works with the built-in authentication system, not Clerk
3. **Two versions of `has_role` function exist**: one for UUID (old) and one for TEXT (new), causing type conflicts

## What Needs to Change

### 1. Update the `useUserRole` Hook
The current hook is almost correct but may have timing issues. We'll add better error logging to help debug.

**File:** `src/hooks/useUserRole.ts`
- Add console logging to see what's happening during the role check
- Ensure the query is correctly matching the Clerk user ID

### 2. Database Cleanup (Migration Required)
Since the app uses Clerk (not the built-in authentication), the existing database functions and policies that rely on `auth.uid()` won't work. We need to:

**Drop the old UUID-based `has_role` function:**
```sql
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);
```

This removes the conflicting function that causes type mismatch errors.

### 3. Verify Admin Role Entry
The database already shows your admin entry:
```text
user_id: user_394ojzQGIrkwkvHPjt79momfIX2
role: admin
```

This is correct and should work once the hook properly queries it.

## Technical Details

### Why `auth.uid()` Doesn't Work with Clerk
- `auth.uid()` is a backend function that returns the authenticated user's ID from the built-in auth system
- With Clerk, users authenticate through Clerk's service, not the backend auth
- This means `auth.uid()` returns `null` when using Clerk

### Current Flow (Broken)
```text
1. User logs in with Clerk
2. useUserRole hook gets Clerk user ID
3. Query to user_roles table works (RLS allows SELECT)
4. BUT... admin role check succeeds in the hook
5. Something else may be blocking access
```

### Investigation Notes
The `useUserRole` hook should be working since:
- The RLS policy `Anyone can read roles for auth check` allows all SELECTs
- The Clerk user ID is in the database with 'admin' role

Let me add logging to identify exactly where the failure occurs.

## Implementation Steps

1. **Update `useUserRole.ts`** - Add console logging for debugging
2. **Run database migration** - Remove conflicting UUID function
3. **Test admin access** - Verify the admin panel loads correctly

## Estimated Changes
- 1 file modification (`useUserRole.ts`)
- 1 database migration (drop conflicting function)
