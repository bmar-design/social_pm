import React from 'react';
import { Pressable, Text, View, StyleSheet, TextInput, type TextInputProps } from 'react-native';
export const colors = { bg: '#101411', card: '#1a211b', text: '#f6f5ed', muted: '#b6c0b4', accent: '#d8f279', border: '#364237' };
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg }, content: { padding: 20, gap: 16, paddingBottom: 36 },
  title: { fontSize: 32, fontWeight: '700', color: colors.text, letterSpacing: -1 },
  heading: { fontSize: 21, fontWeight: '600', color: colors.text }, text: { fontSize: 17, lineHeight: 25, color: colors.text },
  muted: { fontSize: 14, lineHeight: 21, color: colors.muted }, label: { fontSize: 12, letterSpacing: 2, color: colors.accent, fontWeight: '700' },
  card: { padding: 18, borderRadius: 20, backgroundColor: colors.card, gap: 12, borderWidth: 1, borderColor: colors.border },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, fontSize: 17, color: colors.text, backgroundColor: colors.card },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
});
export function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14,
      backgroundColor: secondary ? colors.card : colors.accent, borderColor: colors.border, borderWidth: secondary ? 1 : 0, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}>
    <Text style={{ color: secondary ? colors.text : colors.bg, fontSize: 16, fontWeight: '600' }}>{title}</Text>
  </Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 6 }}><Text style={styles.muted}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={styles.input} {...props} /></View>;
}
export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
