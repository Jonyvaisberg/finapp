# FinApp - Smart Personal Finance Manager

A mobile-first personal financial management app that helps you understand your spending by ingesting bank CSVs and receipt images, automatically categorizing transactions using AI, and allowing you to reshape categories using natural language.

## 🎯 Features

### Core Capabilities
- **📊 CSV Import**: Upload bank statements from any major bank
- **📸 Receipt OCR**: Scan receipts using AI-powered image recognition
- **🤖 AI Categorization**: Automatic transaction categorization with confidence scoring
- **💬 Natural Language Commands**: Control your finances using plain English
- **📈 Visual Analytics**: Interactive charts and spending insights
- **🔄 Smart Deduplication**: Automatic detection and prevention of duplicate transactions
- **💾 Local-First**: All data stored securely in your browser
- **📱 Mobile-First Design**: Optimized for mobile devices with responsive UI

### Screens

#### 1. Input Screen
- Upload CSV files from bank statements
- Upload receipt or statement images
- AI extracts and normalizes transactions
- Automatic deduplication and error handling

#### 2. Categorization Screen
- Review all transactions with AI-assigned categories
- Confidence indicator for each transaction
- Change category with one tap
- Create new categories inline
- Apply rules automatically
- Natural language command interface

#### 3. Dashboard Screen
- Total spending visualization with pie charts
- Category breakdown with transaction counts
- Planned vs actual spending (optional)
- AI-generated spending insights
- Time period filtering (week, month, year, all)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Database**: IndexedDB (via Dexie.js)
- **CSV Parsing**: PapaParse
- **OCR**: Tesseract.js
- **Charts**: Recharts
- **Icons**: Lucide React

### Project Structure
```
src/
├── components/          # Reusable UI components
│   ├── BottomNav.tsx
│   └── ConfidenceBadge.tsx
├── screens/            # Main app screens
│   ├── InputScreen.tsx
│   ├── CategorizationScreen.tsx
│   └── DashboardScreen.tsx
├── services/           # Business logic and APIs
│   ├── database.ts          # IndexedDB setup and operations
│   ├── csvParser.ts         # CSV parsing logic
│   ├── ocrService.ts        # Receipt OCR processing
│   ├── categorizationService.ts  # AI categorization
│   └── nlCommandService.ts  # Natural language processing
├── store/              # State management
│   └── useStore.ts
├── models/             # TypeScript types and interfaces
│   └── types.ts
├── utils/              # Helper functions
│   └── helpers.ts
├── App.tsx             # Main app component
└── main.tsx            # App entry point
```

## 💡 Usage Examples

### Importing Transactions

1. **CSV Upload**:
   - Navigate to Import screen
   - Click "Upload CSV File"
   - Select your bank statement CSV
   - AI automatically categorizes transactions
   - Review and adjust categories as needed

2. **Receipt Upload**:
   - Navigate to Import screen
   - Click "Upload Receipt Image"
   - Take a photo or select existing image
   - OCR extracts transaction details
   - Review and categorize

### Natural Language Commands

The app supports intuitive commands in the Categorization screen:

```
Create category Car
→ Creates a new category called "Car"

Merge Dining and Restaurants
→ Combines two categories into one

Move all Uber to Transportation
→ Recategorizes all Uber transactions

Always treat Starbucks as Dining
→ Creates an automatic rule
```

### Category Management

- **Create**: Use natural language or click "New Category" button
- **Edit**: Click on any category to change name or color
- **Delete**: Categories can be removed (transactions move to "Uncategorized")
- **Merge**: Combine multiple categories using natural language

## 🎨 Design Principles

1. **Mobile-First**: Optimized for touch interactions and small screens
2. **AI Suggests, User Controls**: AI provides suggestions, user makes final decisions
3. **Simple Flows**: No financial jargon, intuitive interactions
4. **Flexible Categories**: User-defined categories that adapt to your needs
5. **Insights Over Judgment**: Helpful analysis without being preachy

## 🔒 Privacy & Security

- **Local-First**: All data stored in browser's IndexedDB
- **No Server**: No data ever leaves your device
- **Privacy by Default**: No tracking or analytics
- **Undoable Actions**: All operations can be reversed

## 📊 Data Model

### Transaction
```typescript
{
  id: string;
  date: Date;
  amount: number;
  vendor: string;
  normalizedVendor: string;
  categoryId: string | null;
  confidence: number;  // 0-1, AI confidence
  source: 'csv' | 'receipt' | 'manual';
  duplicateCheckHash: string;
}
```

### Category
```typescript
{
  id: string;
  name: string;
  color: string;
  plannedAmount?: number;  // Optional budget
}
```

### Rule
```typescript
{
  type: 'vendor' | 'amount' | 'description';
  condition: {
    operator: 'equals' | 'contains' | 'startsWith';
    value: string;
  };
  action: {
    categoryId: string;
  };
}
```

## 🤖 AI Capabilities

### Transaction Classification
- Pattern matching against common vendors
- Learning from user corrections
- Confidence scoring for each categorization

### Vendor Normalization
- Removes payment processor prefixes (Square, Toast, etc.)
- Standardizes common merchant names
- Removes location codes and store numbers

### Receipt OCR
- Extracts merchant name, date, and total
- Handles various receipt formats
- Provides feedback on extraction confidence

### Natural Language Processing
- Intent recognition for common commands
- Entity extraction (categories, vendors, amounts)
- Fuzzy matching for category names

## 🛠️ Development

### Adding New Features

1. **New Category Rule**: Edit `src/services/categorizationService.ts`
2. **New NL Command**: Update `src/services/nlCommandService.ts`
3. **New Screen**: Create in `src/screens/` and wire up in `App.tsx`
4. **New Data Model**: Add to `src/models/types.ts` and update database schema

### Running Tests
```bash
npm test
```

### Code Quality
```bash
# Type check
npm run type-check

# Lint
npm run lint
```

## 📈 Future Enhancements

- [ ] Budget tracking and alerts
- [ ] Recurring transaction detection
- [ ] Export to multiple formats (PDF, Excel)
- [ ] Multi-currency support
- [ ] Sync across devices (optional)
- [ ] Advanced filtering and search
- [ ] Custom dashboard widgets
- [ ] Split transactions
- [ ] Scheduled transactions

## 🤝 Contributing

This is a personal finance app built for individual use. Feel free to fork and customize for your needs!

## 📄 License

MIT License - feel free to use and modify as needed.

## 🙏 Acknowledgments

- Built with modern web technologies
- Designed with privacy and simplicity in mind
- Inspired by the need for judgment-free financial tools
