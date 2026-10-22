import React from 'react';
import { Pressable, Text, View, StyleSheet, TextInput, type TextInputProps } from 'react-native';
// Shared Pascal palette from hosted/app/globals.css.
export const colors = {
  bg: '#fcf3e5', card: '#fff8ef', text: '#442f22', muted: '#90765d',
  accent: '#ac4c32', border: '#edd2af', primary: '#e66e4c', onPrimary: '#442f22',
  plum: '#582d7c', accentSoft: '#f8e8dd', plumSoft: '#eee0f2', avatar: '#efd9bc',
};
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg }, content: { padding: 20, gap: 16, paddingBottom: 36 },
  title: { fontSize: 32, fontWeight: '600', color: colors.text, letterSpacing: -1 },
  heading: { fontSize: 19, fontWeight: '600', color: colors.text }, text: { fontSize: 15, lineHeight: 23, color: colors.text },
  muted: { fontSize: 13, lineHeight: 20, color: colors.muted }, label: { fontSize: 10, letterSpacing: 1.5, color: colors.accent, fontWeight: '600' },
  card: { padding: 18, borderRadius: 20, backgroundColor: colors.card, gap: 12, borderWidth: 1, borderColor: colors.border },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, fontSize: 17, color: colors.text, backgroundColor: colors.card },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
});
export function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14,
      backgroundColor: secondary ? colors.card : colors.primary, borderColor: colors.border, borderWidth: secondary ? 1 : 0, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}>
    <Text style={{ color: secondary ? colors.text : colors.onPrimary, fontSize: 16, fontWeight: '600' }}>{title}</Text>
  </Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 6 }}><Text style={styles.muted}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={styles.input} {...props} /></View>;
}
export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
