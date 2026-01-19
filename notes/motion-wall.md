# Motion Wall Implementation Notes

## Overview
Motion Wall is a new view mode for UI3 that displays only cameras currently detecting motion within the selected camera group.

## Motion Detection
- **Property Used:** `bMotion` flag in `StatusBlock` (line 34011 in ui3.js)
- **Source:** Blue Iris motion detection state (not alerts)
- **Update Mechanism:** Status updates arrive via `acceptStatusBlock` callback (line 19730)
  - Called when new video frames arrive with status data
  - Status updates trigger `BI_CustomEvent.Invoke("Video Status Block")` event

## Camera Status Updates
- **StatusLoader** (line 15114): Periodically calls `/status` API (every 5 seconds)
- **Per-Camera Status:** Motion state is embedded in video stream via StatusBlock
- **Motion Events:**
  - Motion start detected when `status.bMotion && (!lastStatusBlock || !lastStatusBlock.bMotion)`
  - Triggers sound event: `biSoundPlayer.PlayEvent("motion")` (line 19743)

## Group View Rendering
- **Group Data Structure:**
  - `group`: Array of camera IDs (short names) in the group
  - `rects`: Array of [x1, y1, x2, y2] coordinates for grid positioning
  - Retrieved via `CameraListLoader.GetGroupCams(groupId)` and `GetGroupRects(groupId)`
- **Current Group:** Tracked via dropdown and `videoPlayer.Loading().image.id`
- **Grid Layout:** Fixed-slot grid where each camera has a predetermined position

## Implementation Approach

### 1. MotionWallManager Class
New class that manages:
- Camera visibility state (visible, hidden)
- Linger timers for each camera
- Pin state persistence
- Grid rendering
- Settings management

### 2. View Mode
- Added as overlay mode on top of existing "live" view
- Toggled via top-bar button
- When active:
  - Renders custom grid view overlaying `#camimg_wrapper`
  - Stops existing player
  - Creates individual JPEG/H264 streams for each visible camera tile
  - Uses substream by default

### 3. Motion Lifecycle
- **Motion Start:** Camera tile becomes visible, starts streaming (substream)
- **Motion End:** Start linger timer (default 10 seconds)
- **Linger Expires:** Stop stream, tile becomes blank/hidden
- **Motion Restart:** Cancel pending hide timer, keep tile visible

### 4. Pinning
- Pin button overlay on each tile
- Pinned cameras stay visible regardless of motion state
- Pin state persisted in localStorage per-user
- Key: `ui3_motionwall_pinned_<username>`

### 5. Settings
- **lingerSeconds:** Time to keep showing camera after motion ends (0-120, default 10)
- **excludeGroups:** Array of group IDs that cannot use Motion Wall
- Stored as: `ui3_motionwall_lingerSeconds`, `ui3_motionwall_excludeGroups`
- Settings UI accessed via gear icon next to toggle button

## Key Files Modified
- `ui3/ui3.js`: Added MotionWallManager class and integration
- `ui3/ui3.htm`: Added Motion Wall toggle button to top bar
- `ui3/ui3.css`: Added Motion Wall grid styling

## Technical Details

### Camera Stream URLs
Each visible tile uses substream URLs:
- Format: `image/<camera_short_name>?time=<timestamp>&w=<width>&h=<height>`
- Or H264: similar URL pattern via existing stream API

### Grid Positioning
Uses CSS Grid or absolute positioning based on rects array:
```javascript
// rect = [x1, y1, x2, y2] normalized to group dimensions
// Convert to CSS:
left = (x1 / groupWidth) * 100 + '%'
top = (y1 / groupHeight) * 100 + '%'
width = ((x2 - x1) / groupWidth) * 100 + '%'
height = ((y2 - y1) / groupHeight) * 100 + '%'
```

### Motion State Tracking
Subscribes to global status updates via:
- Custom event listener on "Video Status Block" for real-time updates
- Fallback: polling via StatusLoader every 5 seconds

## Edge Cases Handled
1. Group switching: Rebind to new group, clear invisible cameras
2. Excluded groups: Disable Motion Wall, show toast notification
3. Tab switching: Deactivate Motion Wall when leaving "live" tab
4. Page reload: Restore pinned cameras from localStorage
5. Camera deletion/rename: Handle gracefully by ID lookup
6. No motion: All tiles blank (no fallback grid)
7. Rapid motion flapping: Debounce hide timers
