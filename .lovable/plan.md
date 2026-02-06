

## תוכנית: שינוי רקע כפתור "הכל" בדף האירועים

### מה ישתנה
שינוי סטיילינג של **כפתור אחד בלבד** - כפתור "הכל" (All) בדף `/events`

### התנהגות חדשה

| מצב | רקע |
|-----|-----|
| לא לחוץ | כחול (`bg-blue-600`) |
| לחוץ (נבחר) | כמעט שחור (`bg-slate-950`) |

### פרטים טכניים

**קובץ:** `src/pages/Events.tsx`

**שורות:** 136-143

**שינוי:**
```text
לפני:
className={filter === 'all' ? '' : 'border-slate-600 text-white/60'}

אחרי:
className={filter === 'all' 
  ? 'bg-slate-950 hover:bg-black text-white' 
  : 'bg-blue-600 hover:bg-blue-700 text-white'}
```

