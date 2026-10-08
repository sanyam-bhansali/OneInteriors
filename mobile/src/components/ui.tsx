import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, font, radius, space } from '../lib/theme';

export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <Text style={styles.title} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[styles.text, muted && styles.muted]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <Text style={styles.error} accessibilityRole="alert">
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  busy,
  disabled,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'quiet';
}) {
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'quiet' && styles.buttonQuiet,
        off && styles.buttonOff,
        pressed && !off && styles.buttonPressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'quiet' ? color.ink : color.paper} />
      ) : (
        <Text style={[styles.buttonText, variant === 'quiet' && styles.buttonQuietText]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={color.ink3}
        style={styles.input}
        {...input}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  fill: { flex: 1 },
  body: { padding: space.lg, paddingTop: space.xl, gap: space.md, flexGrow: 1 },
  footer: { padding: space.lg, paddingTop: space.sm, gap: space.sm },
  eyebrow: {
    fontFamily: font.sansMedium,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: color.ink3,
  },
  title: { fontFamily: font.display, fontSize: 38, lineHeight: 42, color: color.ink },
  text: { fontFamily: font.sans, fontSize: 17, lineHeight: 25, color: color.ink2 },
  muted: { color: color.ink3, fontSize: 15, lineHeight: 22 },
  error: {
    fontFamily: font.sans,
    fontSize: 15,
    lineHeight: 21,
    color: color.atrisk,
    backgroundColor: color.atriskSoft,
    padding: space.md,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  button: {
    minHeight: 54,
    borderRadius: radius.pill,
    backgroundColor: color.petrolDeep,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  buttonQuiet: { backgroundColor: 'transparent', borderWidth: 1, borderColor: color.rule },
  buttonOff: { opacity: 0.45 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { fontFamily: font.sansBold, fontSize: 17, color: color.paper },
  buttonQuietText: { color: color.ink },
  field: { gap: space.xs },
  label: { fontFamily: font.sansMedium, fontSize: 15, color: color.ink },
  input: {
    fontFamily: font.sans,
    fontSize: 18,
    color: color.ink,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: color.rule,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: 54,
  },
  hint: { fontFamily: font.sans, fontSize: 13, color: color.ink3 },
});
