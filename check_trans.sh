#!/bin/bash

echo "CHECKING TRANSLATION KEYS..."
echo "==================================="

# Extract keys from ru.json using grep
RU_KEYS=$(grep -o '"[^"]*":' d:/Projects/Hrsystem/hrsystemNew/client/src/locales/ru.json | sed 's/"//g' | sed 's/:$//' | sort -u)

# Get all keys used in components
echo ""
echo "HARDCODED STRINGS FOUND IN:"
echo ""

echo "1. AttendanceTableFilter.jsx:"
grep -E '(placeholder|title|aria-label|"[А-Я]|>.*[А-Я])' d:/Projects/Hrsystem/hrsystemNew/client/src/components/AttendanceTableFilter.jsx | grep -E '(Дата|clearAll|apply)' || echo "   (Uses translations via 't' prop)"

