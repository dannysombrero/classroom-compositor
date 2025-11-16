# 🎨 Available Color Palettes

You now have **5 color palettes** to choose from!

## 1. 🟣 Warm Educator (Default)
**Best for:** General education, creative subjects, welcoming atmosphere

**Colors:**
- Primary: Purple (#8b5cf6) - Creative, friendly
- Secondary: Orange (#f59e0b) - Warm, energetic
- Success: Green (#10b981)

**Vibe:** Approachable, creative, welcoming

---

## 2. 🟢 Fresh & Modern
**Best for:** STEM, professional development, tech courses

**Colors:**
- Primary: Teal (#14b8a6) - Clean, professional
- Secondary: Coral (#f97316) - Energetic
- Success: Mint (#34d399)

**Vibe:** Modern, clean, trustworthy

---

## 3. 🔵 Playful Classroom
**Best for:** Elementary, arts, engaging content, younger students

**Colors:**
- Primary: Blue (#3b82f6) - Trustworthy
- Secondary: Pink (#ec4899) - Fun
- Success: Lime (#84cc16)

**Vibe:** Fun, vibrant, engaging

---

## 4. 🌙 Midnight Scholar (NEW!)
**Best for:** Advanced courses, evening classes, sophisticated content

**Colors:**
- Primary: Indigo (#6366f1) - Deep, sophisticated
- Secondary: Amber (#f59e0b) - Warm accent
- Success: Green (#22c55e)

**Vibe:** Sophisticated, focused, scholarly

---

## 5. 🌲 Forest Academy (NEW!)
**Best for:** Environmental studies, natural sciences, calming atmosphere

**Colors:**
- Primary: Emerald (#059669) - Natural, calming
- Secondary: Orange (#ea580c) - Earth tone
- Success: Green (#10b981)

**Vibe:** Natural, grounded, peaceful

---

## 🎯 How to Test

Visit **http://localhost:5175/playground-simple** and click through all 5 palettes!

Watch how:
- Button colors change
- Color swatches update
- The entire UI adapts

## 💡 Choosing Your Palette

Consider:
1. **Your subject matter** - STEM vs Arts vs General
2. **Your audience** - Elementary vs College vs Professional
3. **Your brand** - What colors represent you?
4. **Your mood** - Energetic vs Calm vs Professional

## 🔧 Set Your Default

Once you pick your favorite, edit `src/theme/index.ts` line 11:

```typescript
let activePaletteName: PaletteName = 'forestAcademy'; // Change this!
```

Options: `'warmEducator'` | `'freshModern'` | `'playfulClassroom'` | `'midnightScholar'` | `'forestAcademy'`