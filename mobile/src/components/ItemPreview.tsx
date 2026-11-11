import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../lib/i18n';
import { itemPageUrl, photoUrl, type ItemRef } from '../lib/items';
import { color, font, radius } from '../lib/theme';

/**
 * A quotation line's name you can tap (owner, 10 Nov 2026): a tap shows the
 * item's photo; "See what it is" opens its page on the website. No item:
 * the name as plain text.
 */
export function ItemTap({ item, children }: { item: ItemRef | null | undefined; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const t = useT();
  if (!item) return <>{children}</>;
  return (
    <>
      <Pressable
        role="button"
        accessibilityHint={t('item.hint')}
        onPress={() => setOpen(true)}
        hitSlop={6}
        style={({ pressed }) => [styles.name, pressed && { opacity: 0.6 }]}
      >
        {children}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)} accessibilityLabel={t('item.close')}>
          <Pressable style={styles.card} onPress={() => undefined}>
            {item.photo ? (
              <Image source={{ uri: photoUrl(item.photo) }} style={styles.photo} contentFit="cover" accessibilityLabel={item.name} />
            ) : (
              <View style={[styles.photo, styles.none]}>
                <Text style={styles.noneText}>{t('item.noPhoto')}</Text>
              </View>
            )}
            <View style={{ padding: 16, gap: 12 }}>
              <Text style={styles.title}>{item.name}</Text>
              <Pressable
                role="button"
                style={styles.open}
                onPress={() => {
                  setOpen(false);
                  void WebBrowser.openBrowserAsync(itemPageUrl(item.slug));
                }}
              >
                <Text style={styles.openText}>{t('item.open')} ↗</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  name: { borderBottomWidth: 1, borderStyle: 'dotted', borderBottomColor: color.ink3, alignSelf: 'flex-start' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: color.paper, borderRadius: radius.lg, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 4 / 3, backgroundColor: color.line },
  none: { alignItems: 'center', justifyContent: 'center' },
  noneText: { color: color.ink3, fontFamily: font.sans },
  title: { fontFamily: font.sansSemi, fontSize: 18, color: color.ink },
  open: { backgroundColor: color.ink, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  openText: { color: color.paper, fontFamily: font.sansSemi, fontSize: 15 },
});
