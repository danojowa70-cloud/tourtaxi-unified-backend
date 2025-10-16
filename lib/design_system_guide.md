# TourTaxi Driver - Apple-Style Design System

## 🎨 Color Palette

### Primary Colors
- **Background**: Pure White (`0xFFFFFFFF`) - Clean, minimal Apple aesthetic
- **Text**: Pure Black (`0xFF000000`) - Maximum contrast for readability
- **Primary**: iOS Blue (`0xFF007AFF`) - Apple's signature blue for interactive elements
- **Secondary Text**: iOS Gray (`0xFF8E8E93`) - For less important text

### Status Colors
- **Success**: iOS Green (`0xFF34C759`) - For positive actions/states
- **Error**: iOS Red (`0xFFFF3B30`) - For errors and warnings
- **Warning**: iOS Orange (`0xFFFF9500`) - For caution states

### System Grays (iOS Palette)
- **Border**: Light Gray (`0xFFE5E5EA`) - For subtle borders
- **Card Background**: Off-white (`0xFFFAFAFA`) - For card/container backgrounds
- **Separator**: iOS Separator (`0xFFC6C6C8`) - For dividers
- **Placeholder**: Placeholder Text (`0xFFC7C7CD`) - For form placeholders

## 📏 Spacing (8-point grid system)
- **XX Small**: 4px - Minimal spacing
- **X Small**: 6px - Very small elements
- **Small**: 8px - Standard small spacing
- **Medium**: 16px - Standard spacing
- **Large**: 24px - Large spacing
- **X Large**: 32px - Extra large spacing
- **XX Large**: 40px - Maximum spacing

## 📝 Typography (Apple Human Interface Guidelines)
- **Caption**: 12px - Small labels and captions
- **Small**: 14px - Footnotes and secondary info
- **Medium**: 16px - Subheadings
- **Body**: 17px - Standard body text (iOS default)
- **Large**: 20px - Section titles
- **X Large**: 22px - Important titles
- **XX Large**: 28px - Main titles
- **Display**: 34px - Large titles and headers

## 🔲 Corner Radius
- **Small**: 8px - Small buttons/elements
- **Standard**: 10px - iOS standard radius
- **Large**: 16px - Cards and large containers

## Usage Examples

### Card Container
```dart
Container(
  decoration: BoxDecoration(
    color: const Color(AppConstants.cardBackgroundColorValue),
    borderRadius: BorderRadius.circular(AppConstants.borderRadiusLarge),
    border: Border.all(
      color: const Color(AppConstants.borderColorValue),
      width: AppConstants.separatorHeight,
    ),
  ),
  child: // your content
)
```

### Text Styles
```dart
// Main title
Text(
  'Main Title',
  style: const TextStyle(
    fontSize: AppConstants.fontSizeXXLarge,
    fontWeight: FontWeight.bold,
    color: Color(AppConstants.textColorValue),
  ),
)

// Body text
Text(
  'Body content here',
  style: const TextStyle(
    fontSize: AppConstants.fontSizeBody,
    color: Color(AppConstants.textColorValue),
  ),
)

// Secondary text
Text(
  'Secondary info',
  style: const TextStyle(
    fontSize: AppConstants.fontSizeSmall,
    color: Color(AppConstants.secondaryTextColorValue),
  ),
)
```

### Button Styles
```dart
CupertinoButton(
  color: const Color(AppConstants.primaryColorValue),
  borderRadius: BorderRadius.circular(AppConstants.borderRadius),
  padding: const EdgeInsets.symmetric(
    horizontal: AppConstants.spacingLarge,
    vertical: AppConstants.spacingMedium,
  ),
  child: const Text(
    'Button Text',
    style: TextStyle(
      fontSize: AppConstants.fontSizeBody,
      fontWeight: FontWeight.w600,
      color: Colors.white,
    ),
  ),
  onPressed: () {},
)
```

## 🚀 Theme Features Applied

✅ **Pure white backgrounds** for clean, minimal look
✅ **Black text** for maximum readability
✅ **iOS Blue accents** for interactive elements
✅ **Apple's SF fonts** (when available on device)
✅ **8-point grid spacing** for consistent layout
✅ **iOS standard corner radius** (10px)
✅ **Apple Human Interface Guidelines typography**
✅ **System color palette** matching iOS design

Your app now follows Apple's design principles with:
- Clean, minimal white interface
- High contrast black text for accessibility
- Consistent spacing and typography
- Apple-approved color palette
- Professional iOS-style appearance