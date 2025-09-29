# Time Tracker MVP

A comprehensive time tracking application built with Next.js, React, and TypeScript. Features hierarchical category management, goal setting, vision planning, and data export capabilities.

## Features

### ⏱️ Time Tracking
- Start/stop sessions with real-time tracking
- Hierarchical categories and subcategories
- Multiple time range views (Today, Week, Month, Year, All)
- Visual pie chart with hover-freeze functionality
- Progress bars showing goal vs actual time

### 🎯 Goal Management
- Set percentage-based goals for categories
- Validation to prevent exceeding 100% totals
- Visual progress indicators
- Goal tracking with completion status

### 👁️ Vision Board
- Upload and manage vision photos
- Create goals linked to categories
- Track goal completion
- Visual inspiration board

### 💾 Data Management
- Local storage persistence
- CSV export functionality
- Data reset capability
- User account management

### ♿ Accessibility
- Keyboard navigation support
- ARIA labels and descriptions
- Screen reader friendly
- High contrast design

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main app component
├── components/            # React components
│   ├── AddForm.tsx       # Category creation form
│   ├── CategoryEditor.tsx # Category editing modal
│   ├── CategoryItem.tsx  # Individual category display
│   ├── ErrorToast.tsx    # Error notification component
│   ├── HomePage.tsx      # Home page component
│   ├── TimeChart.tsx     # Pie chart component
│   ├── TimePage.tsx      # Main time tracking page
│   └── VisionPage.tsx    # Vision board page
├── constants/             # Application constants
│   └── index.ts          # Default data and configuration
├── hooks/                 # Custom React hooks
│   ├── useErrorHandler.ts # Error handling hook
│   ├── useLocalStorage.ts # Local storage hook
│   └── useTimeTracking.ts # Time tracking logic hook
├── types/                 # TypeScript type definitions
│   └── index.ts          # All application types
└── utils/                 # Utility functions
    ├── categoryHelpers.ts # Category-related utilities
    ├── exportHelpers.ts  # Data export utilities
    ├── selfTests.ts      # Self-testing functions
    ├── timeHelpers.ts    # Time calculation utilities
    └── validationHelpers.ts # Input validation utilities
```

## Key Improvements Made

### 🏗️ Architecture
- **Modular Structure**: Broke down the monolithic component into focused, reusable pieces
- **Custom Hooks**: Extracted complex logic into reusable hooks
- **Type Safety**: Comprehensive TypeScript types throughout
- **Separation of Concerns**: Clear separation between UI, logic, and data

### 🚀 Performance
- **Optimized Re-renders**: Better useMemo and useCallback usage
- **Efficient State Management**: Reduced unnecessary state updates
- **Lazy Loading**: Images and components load as needed

### 🛡️ Error Handling
- **Comprehensive Error Handling**: Try-catch blocks with user-friendly messages
- **Loading States**: Visual feedback during operations
- **Graceful Degradation**: App continues working even if some features fail

### ♿ Accessibility
- **ARIA Labels**: Proper labeling for screen readers
- **Keyboard Navigation**: Full keyboard support
- **Focus Management**: Proper focus handling in modals
- **Semantic HTML**: Meaningful HTML structure

### 🎨 User Experience
- **Better Visual Feedback**: Loading states, hover effects, transitions
- **Improved Forms**: Better validation and error messages
- **Responsive Design**: Works well on different screen sizes
- **Intuitive Navigation**: Clear visual hierarchy

## Usage

### Adding Categories
1. Click the "Add Category" button
2. Enter a name and optional goal percentage
3. Choose a color and icon
4. Save the category

### Time Tracking
1. Select a category to start tracking
2. Click the category again to stop
3. View your progress in the pie chart
4. Switch between different time ranges

### Goal Setting
1. Set percentage goals when creating categories
2. Goals are validated to not exceed 100% total
3. Visual progress bars show goal vs actual time

### Vision Board
1. Upload images to represent your vision
2. Create goals linked to specific categories
3. Mark goals as complete when achieved

## Data Storage

All data is stored locally in your browser's localStorage. This includes:
- Categories and subcategories
- Time tracking sessions
- User preferences
- Vision photos and goals

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Development

The project includes self-tests that run automatically to ensure utility functions work correctly. Check the browser console for test results.

## License

This project is open source and available under the MIT License.


