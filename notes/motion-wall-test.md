# Motion Wall Testing Checklist

## Prerequisites
- Blue Iris server running with multiple cameras in groups
- At least one camera group configured
- UI3 loaded and logged in

## Basic Functionality Tests

### 1. Activation / Deactivation
- [ ] Navigate to Live View tab
- [ ] Click Motion Wall button in top bar
- [ ] Verify Motion Wall container appears
- [ ] Verify normal video player is hidden
- [ ] Verify Motion Wall button shows "selected" state (highlighted)
- [ ] Verify Settings button appears next to Motion Wall button
- [ ] Click Motion Wall button again
- [ ] Verify Motion Wall deactivates
- [ ] Verify normal video player returns

### 2. Group Selection
- [ ] Select a camera group from dropdown
- [ ] Activate Motion Wall
- [ ] Verify grid layout matches group camera positions
- [ ] Verify all camera tiles are initially blank/hidden (if no motion)
- [ ] Try to activate Motion Wall without selecting a group
- [ ] Verify appropriate error message appears
- [ ] Try to activate Motion Wall with a single camera selected
- [ ] Verify error message about requiring a group

### 3. Motion Detection & Visibility

**Note:** Motion Wall currently uses a simplified polling approach. For full integration, motion state needs to be connected to Blue Iris status updates. For testing, you can simulate motion by manually triggering motion on cameras in Blue Iris.

- [ ] With Motion Wall active, trigger motion on a camera in the group
- [ ] Verify camera tile becomes visible in its correct grid position
- [ ] Verify camera begins streaming (JPEG substream)
- [ ] Stop motion on the camera
- [ ] Verify camera tile remains visible during linger period
- [ ] After linger period expires (default 10 seconds), verify tile becomes hidden
- [ ] Re-trigger motion before linger expires
- [ ] Verify linger timer is cancelled and tile remains visible

### 4. Grid Layout & Positioning
- [ ] Select different groups with varying layouts (2x2, 3x3, etc.)
- [ ] Activate Motion Wall for each
- [ ] Verify tiles appear in correct positions matching group grid
- [ ] Verify tile sizes are proportional to their rects
- [ ] Verify blank spaces appear for non-visible cameras
- [ ] Verify no camera packing/reordering occurs

### 5. Camera Tile Interaction
- [ ] Click on a visible camera tile
- [ ] Verify Motion Wall deactivates
- [ ] Verify UI3 switches to single-camera fullscreen view for that camera
- [ ] Verify stream type is appropriate (not substream in single view)

### 6. Pin Functionality
- [ ] With Motion Wall active, click pin button on a tile
- [ ] Verify pin icon becomes fully opaque
- [ ] Verify tooltip changes to "Unpin camera"
- [ ] Verify camera tile remains visible even after motion ends
- [ ] Wait past linger period
- [ ] Verify pinned tile does NOT disappear
- [ ] Click pin button again to unpin
- [ ] Verify pin icon becomes semi-transparent
- [ ] If no motion, verify camera hides after linger period
- [ ] Refresh page
- [ ] Activate Motion Wall again
- [ ] Verify previously pinned cameras are still pinned (persistence)

### 7. Settings Panel

#### Open Settings
- [ ] With Motion Wall active, click Settings button
- [ ] Verify settings dialog opens with modal overlay
- [ ] Verify "Linger Time" input shows current value (default 10)
- [ ] Verify "Excluded Groups" list shows all camera groups with checkboxes

#### Linger Time Configuration
- [ ] Change linger time to 5 seconds
- [ ] Click Save
- [ ] Trigger motion on a camera, then stop
- [ ] Verify camera hides after 5 seconds (not 10)
- [ ] Set linger time to 0
- [ ] Trigger/stop motion
- [ ] Verify camera hides immediately when motion ends
- [ ] Set linger time to 30
- [ ] Trigger/stop motion
- [ ] Verify camera remains visible for 30 seconds
- [ ] Try invalid values (negative, >120)
- [ ] Verify values are clamped to 0-120 range

#### Excluded Groups
- [ ] Open settings
- [ ] Check the checkbox for the currently selected group
- [ ] Click Save
- [ ] Verify Motion Wall deactivates
- [ ] Verify toast message explains group is excluded
- [ ] Try to activate Motion Wall again
- [ ] Verify warning message about excluded group
- [ ] Select a different (non-excluded) group
- [ ] Activate Motion Wall
- [ ] Verify it works
- [ ] Switch to excluded group
- [ ] Verify Motion Wall deactivates automatically with notification

#### Settings Persistence
- [ ] Configure linger time and exclude a group
- [ ] Click Save
- [ ] Refresh the page
- [ ] Open settings again
- [ ] Verify linger time is preserved
- [ ] Verify excluded groups list is preserved

### 8. Edge Cases

#### Group Switching
- [ ] Activate Motion Wall for Group A
- [ ] Switch to Group B via dropdown
- [ ] Verify Motion Wall deactivates
- [ ] Verify notification about group change
- [ ] Manually reactivate Motion Wall
- [ ] Verify Motion Wall binds to Group B

#### Tab Switching
- [ ] Activate Motion Wall on Live View tab
- [ ] Switch to Clips tab
- [ ] Verify Motion Wall deactivates
- [ ] Switch back to Live View
- [ ] Verify Motion Wall remains inactive (requires manual reactivation)
- [ ] Switch to Timeline tab
- [ ] Verify Motion Wall stays inactive

#### No Motion Scenario
- [ ] Activate Motion Wall
- [ ] Ensure no cameras have motion
- [ ] Verify all tiles are blank/black (no still frames)
- [ ] Verify no streams are being requested (check network tab in browser dev tools)
- [ ] Pin a camera
- [ ] Verify only pinned camera shows stream
- [ ] Verify unpinned cameras remain blank

#### Camera Not in Group
- [ ] Pin a camera in Group A
- [ ] Switch to Group B (which doesn't contain that camera)
- [ ] Activate Motion Wall
- [ ] Verify pinned camera from Group A does NOT appear in Group B view
- [ ] Verify only Group B cameras can appear

#### Rapid Motion Flapping
- [ ] Trigger motion on/off repeatedly on a single camera
- [ ] Verify tile doesn't flicker excessively
- [ ] Verify linger timers are properly cancelled and restarted
- [ ] Verify no memory leaks or stuck timers (check browser task manager)

#### Many Cameras with Motion
- [ ] Use a large group (8+ cameras)
- [ ] Trigger motion on all cameras simultaneously
- [ ] Verify all tiles appear and stream properly
- [ ] Verify performance is acceptable
- [ ] Stop motion on all
- [ ] Verify all tiles hide after linger period

### 9. Performance & Stability

#### Stream Management
- [ ] Activate Motion Wall with multiple cameras visible
- [ ] Check browser Network tab
- [ ] Verify image requests are being made for visible cameras only
- [ ] Verify no requests for blank tiles
- [ ] Deactivate Motion Wall
- [ ] Verify all streams stop immediately
- [ ] Verify no lingering requests

#### DOM Management
- [ ] Activate/deactivate Motion Wall multiple times
- [ ] Verify no memory leaks (check browser memory usage)
- [ ] Verify tiles are properly cleaned up on deactivation
- [ ] Inspect DOM in developer tools
- [ ] Verify no orphaned elements

#### Long Running Session
- [ ] Keep Motion Wall active for extended period (30+ minutes)
- [ ] Trigger motion periodically
- [ ] Verify no degradation in performance
- [ ] Verify linger timers still work correctly
- [ ] Verify pinned cameras stay stable

### 10. UI/UX Polish

#### Visual Appearance
- [ ] Verify tile borders are visible
- [ ] Verify camera labels are readable
- [ ] Verify pin buttons are visible and accessible
- [ ] Verify hover states work on tiles and pin buttons
- [ ] Verify Motion Wall button highlight matches UI theme
- [ ] Test in different browser zoom levels
- [ ] Verify layout scales appropriately

#### Notifications
- [ ] Verify appropriate toasts/notifications for:
  - [ ] Motion Wall activated
  - [ ] Group is excluded
  - [ ] No group selected
  - [ ] Single camera selected (not a group)
  - [ ] Camera pinned/unpinned
  - [ ] Settings saved
  - [ ] Group switched while active

#### Keyboard & Accessibility
- [ ] Tab through UI to Motion Wall button
- [ ] Press Enter to activate
- [ ] Verify keyboard navigation works in settings dialog
- [ ] Tab through checkboxes in excluded groups list
- [ ] Press Escape to close settings dialog

## Known Limitations (To Document)

- [ ] Motion state currently uses simplified polling; full integration with Blue Iris status blocks would provide real-time motion detection
- [ ] Stream type is always JPEG substream (not H.264) for Motion Wall tiles
- [ ] No support for group dynamic layout changes while Motion Wall is active
- [ ] No motion indicator overlay on tiles (could be added in future)

## Sign-Off

Tester Name: ___________________
Date: ___________________
Blue Iris Version: ___________________
UI3 Version: 315 + Motion Wall
Browser: ___________________

Overall Status: [ ] Pass  [ ] Pass with minor issues  [ ] Fail

Issues Found:
_______________________________________________
_______________________________________________
_______________________________________________
