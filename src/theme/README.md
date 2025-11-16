# 🎨 Theme System

This is the foundation for the educator-friendly design system. It provides a flexible, themeable approach to styling the application.

## 🚀 Quick Start

### View the Theme Playground

Visit `/playground` in your browser to:
- Switch between 3 color palettes instantly
- Try different fonts (DM Sans, Plus Jakarta Sans, Inter)
- See all components with the current theme
- Preview real-world examples

### Using the Theme in Code

```typescript
import { theme } from '../theme';

// Access current colors
const primaryColor = theme.colors.primary;

// Use CSS variables (recommended)
<div style={{ background: 'var(--color-primary)' }}>
  Themed content
</div>

// Switch palettes programmatically
theme.setActivePalette('freshModern');

// Switch fonts programmatically
theme.setActiveFont('plusJakartaSans');
```

## 📦 Available Components

All components automatically use the theme:

```typescript
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

// Use them with variants
<Button variant="primary">Click me</Button>
<Badge variant="success">Live</Badge>
```

## 🎨 Color Palettes

### Warm Educator (Default)
- Primary: Purple (#8b5cf6) - Creative, friendly
- Secondary: Orange (#f59e0b) - Warm, energetic
- Best for: General education, creative subjects

### Fresh & Modern
- Primary: Teal (#14b8a6) - Clean, professional
- Secondary: Coral (#f97316) - Energetic
- Best for: STEM, professional development

### Playful Classroom
- Primary: Blue (#3b82f6) - Trustworthy
- Secondary: Pink (#ec4899) - Fun
- Best for: Elementary, arts, engaging content

## 🔤 Typography

### DM Sans (Default)
Friendly, rounded, highly readable - perfect for educators

### Plus Jakarta Sans
Modern, geometric, approachable

### Inter
Clean, professional fallback

## 📐 Design Tokens

All available CSS variables:

### Colors
```css
--color-primary
--color-primary-hover
--color-primary-light
--color-secondary
--color-success
--color-danger
--color-warning
--color-background
--color-surface
--color-text
--color-text-muted
--color-border
```

### Spacing
```css
--spacing-1  /* 4px */
--spacing-2  /* 8px */
--spacing-4  /* 16px */
--spacing-6  /* 24px */
```

### Shadows
```css
--shadow-sm
--shadow-md
--shadow-lg
```

### Radius
```css
--radius-sm   /* 6px */
--radius-md   /* 10px */
--radius-lg   /* 14px */
--radius-full /* 9999px */
```

## 🔧 Customization

### Change Active Palette

Edit `src/theme/index.ts`:

```typescript
let activePaletteName: PaletteName = 'warmEducator'; // Change this
```

Or programmatically:

```typescript
import { theme } from './theme';
theme.setActivePalette('freshModern');
```

### Change Active Font

Edit `src/theme/index.ts`:

```typescript
let activeFontName: FontName = 'dmSans'; // Change this
```

Or programmatically:

```typescript
import { theme } from './theme';
theme.setActiveFont('plusJakartaSans');
```

### Create Custom Palette

Add to `src/theme/colors.ts`:

```typescript
export const myCustomPalette: ColorPalette = {
  name: 'My Custom',
  primary: '#your-color',
  // ... other colors
};

export const palettes = {
  warmEducator: warmEducatorPalette,
  freshModern: freshModernPalette,
  playfulClassroom: playfulClassroomPalette,
  myCustom: myCustomPalette, // Add here
} as const;
```

## 🎯 Next Steps

1. ✅ **Phase 1 Complete** - Foundation is ready
2. 🔄 **Phase 2** - Apply to existing components:
   - FloatingPanel
   - LayersPanel
   - ControlStrip
3. 🎨 **Phase 3** - Add micro-interactions and polish
4. 🚀 **Phase 4** - Light mode, illustrations, advanced features

## 💡 Tips

- Always use CSS variables instead of hardcoded colors
- Use the themed components (`Button`, `Input`, etc.) for consistency
- Test your changes in the `/playground` before applying to main app
- The theme system is non-breaking - existing code still works!

## 🐛 Troubleshooting

**Colors not updating?**
- Make sure you're using CSS variables: `var(--color-primary)`
- Check that theme is initialized in `main.tsx`

**Fonts not loading?**
- Verify Google Fonts import in `index.css`
- Check browser console for font loading errors

**Components look wrong?**
- Clear browser cache
- Restart dev server
- Check that you're importing from `@/components/ui`