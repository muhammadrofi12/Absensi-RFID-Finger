# Design Guidelines: IoT Employee Attendance System

## Design Approach

**Selected System**: Material Design 3 with admin dashboard optimizations
**Rationale**: Information-dense interface requiring clear data hierarchy, real-time status feedback, and form-heavy interactions. Material Design provides robust patterns for tables, modals, and status indicators essential for enterprise applications.

## Core Design Principles

1. **Data Clarity First**: Prioritize readability and scannability of employee records and attendance logs
2. **Status Visibility**: Real-time IoT connection states and attendance actions must be immediately obvious
3. **Efficient Workflows**: Minimize clicks for common actions (add, edit, scan RFID)
4. **Trustworthy Feedback**: Clear confirmation dialogs for destructive actions

---

## Typography System

**Font Family**: Inter (via Google Fonts CDN) - excellent for data-dense interfaces
- **Headings (Dashboard/Section Titles)**: 2xl (24px), semibold (600)
- **Card/Table Headers**: lg (18px), medium (500)
- **Body/Table Data**: base (16px), regular (400)
- **Status Labels/Badges**: sm (14px), medium (500)
- **Helper Text/Timestamps**: xs (12px), regular (400)

---

## Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, and 16 consistently
- Component padding: p-6
- Card spacing: gap-6
- Table cell padding: px-4 py-3
- Form field spacing: space-y-4
- Modal content: p-8

**Grid Structure**:
- Dashboard: Sidebar (240px fixed) + Main content area (flex-1)
- Employee cards: grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6
- Forms: Single column, max-w-2xl centered

---

## Component Library

### Navigation & Layout

**Sidebar Navigation**:
- Fixed left sidebar, full height
- Navigation items with icons (Heroicons) + labels
- Active state: subtle background highlight
- Sections: Dashboard, Employees, Attendance Logs, IoT Status

**Top Bar**:
- System status indicator (ESP32 connection)
- Real-time clock
- Admin user dropdown
- Height: h-16 with shadow

### Data Display

**Employee Table**:
- Striped rows for readability (alternating subtle background)
- Columns: Photo (48x48 rounded), Name, Employee ID, RFID ID, Fingerprint Status, Actions
- Sticky header on scroll
- Hover state on rows
- Action buttons (Edit/Delete icons) aligned right

**Status Badges**:
- Pill-shaped with icon + text
- IoT Connected: Green indicator dot
- RFID Enrolled: Blue badge
- Fingerprint Enrolled: Purple badge
- Attendance Status: Success (green), Pending (amber)

**Attendance Log Cards**:
- Timeline-style vertical list
- Each entry: Employee name, action (Check-in/Check-out), timestamp, method (RFID+FP)
- Grouped by date with date headers

### Forms & Modals

**Add/Edit Employee Modal**:
- Overlay: semi-transparent backdrop (backdrop-blur-sm)
- Modal: max-w-2xl, rounded-xl, shadow-2xl, slide-in animation
- Header: Title + close button (×)
- Form fields with floating labels
- RFID field: Input + "Scan RFID" button (primary style, with scan icon)
- Fingerprint enrollment: Status display + "Enroll Fingerprint" button
- Footer: Cancel (ghost) + Save (primary) buttons

**Confirmation Dialog**:
- Smaller modal (max-w-md)
- Warning icon for delete actions
- Clear message: "Are you sure you want to delete [Employee Name]?"
- Buttons: Cancel (ghost) + Confirm Delete (destructive red)

**Primary Button Style**:
- Rounded-lg with px-6 py-3
- Semibold text
- Icons aligned left with mr-2
- Loading state: Spinner + disabled appearance

### Real-Time Elements

**IoT Status Panel** (Dashboard):
- Card with icon, connection status, last activity timestamp
- Visual pulse effect when active
- Quick actions: Test Connection button

**Live Attendance Feed**:
- Real-time updates appear with subtle slide-in animation
- Shows: Employee photo, name, action, timestamp
- Auto-dismiss after 5 seconds or manual close

---

## Animations

**Use Sparingly**:
- Modal entrance: slide-up + fade-in (200ms ease-out)
- Status changes: subtle pulse (1 cycle)
- Live feed entries: slide-in from right (150ms)
- No scroll animations or parallax effects

---

## Images

**Employee Photos**:
- Circular avatars throughout (48x48 in tables, 96x96 in modals)
- Placeholder: Initials on solid background for missing photos
- Upload during registration with preview

**No Hero Image**: This is a functional dashboard - no marketing hero needed. Dashboard begins immediately with data and actions.

---

## Page Structure

### Dashboard View
- Stat cards row: Total Employees, Today's Attendance, Active IoT Devices (3-column grid)
- Live attendance feed (right sidebar or below stats)
- Recent employee additions table

### Employees View
- Top bar: Search input + "Add Employee" button (primary, large)
- Filter dropdowns: Department, Status
- Employee table with all data and actions
- Pagination at bottom

### Attendance Logs View
- Date range picker at top
- Filter by employee dropdown
- Timeline-style log display
- Export to CSV button

### Employee Registration Flow
1. Click "Add Employee" → Modal opens
2. Fill basic info (Name, ID, Department, Photo)
3. Click "Scan RFID" → Button shows loading → RFID ID auto-populates
4. Click "Enroll Fingerprint" → Instructions appear → Device waits for scan → Success confirmation
5. Save button creates employee

---

## Responsive Behavior

**Desktop (lg+)**: Sidebar always visible, 3-column stat cards
**Tablet (md)**: Collapsible sidebar, 2-column stat cards
**Mobile**: Hidden sidebar (hamburger menu), single column everything, bottom action bar for primary actions