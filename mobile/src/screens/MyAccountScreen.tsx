import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { fonts, spacing } from '../theme/tokens';
import { useTranslation } from 'react-i18next';
import { Globe, LogOut, ShieldCheck } from 'lucide-react-native';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { ScreenFade } from '../components/common/ScreenFade';
import { useTheme } from '../theme/ThemeProvider';
import { useCaseStore } from '../state/useCaseStore';
import { fetchMyProfile, type PatientProfile } from '../services/api/profileService';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'MyAccount'>;

/**
 * The signed-in patient's real account.
 *
 * Every value is read from Flask + the database on mount and on focus, so it
 * stays correct after a refresh and after signing out and back in. The
 * temporary onboarding draft is deliberately NOT used as a fallback: it is
 * empty after a refresh and would show blank clinical data.
 */
export function MyAccountScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const user = useCaseStore((s) => s.user);
  const logout = useCaseStore((s) => s.logout);
  const lang = useCaseStore((s) => s.language);

  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await fetchMyProfile());
    } catch {
      setError(t('account.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
    return navigation.addListener('focus', () => void load());
  }, [load, navigation]);

  if (!user) {
    return (
      <ScreenFade>
        <View style={{ flex: 1, backgroundColor: c.neutral.background, padding: spacing.md, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ ...fonts.h2, color: c.neutral.text, marginBottom: spacing.md, textAlign: 'center' }}>{t('auth.notLoggedIn')}</Text>
          <Button label={t('auth.signIn')} onPress={() => navigation.navigate('SignIn', { role: 'patient' })} />
        </View>
      </ScreenFade>
    );
  }

  const onLogout = () => {
    // Clears the session (JWTs + cached profile). Server-side patient data is
    // never deleted.
    logout();
    navigation.navigate('Home');
  };

  const name = profile?.name || user.name || '';
  const age = profile?.age ?? user.age ?? null;
  const sex = profile?.sex ?? user.sex ?? null;
  const phone = profile?.phone || user.phone || '';
  const email = profile?.email || user.email || null;
  const symptoms = profile?.symptoms ?? [];
  const answers = profile?.followUpAnswers ?? [];
  const sexLabel = sex === 'M' ? t('details.male') : sex === 'F' ? t('details.female') : '—';

  const answerLabel = (answer: boolean | number | null) => {
    if (answer === null || answer === undefined) return t('followup.notSure');
    if (typeof answer === 'boolean') return answer ? t('review.rowAnswerYes') : t('review.rowAnswerNo');
    return `${answer}/5`;
  };

  return (
    <ScreenFade>
      <View style={{ flex: 1, backgroundColor: c.neutral.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={() => navigation.goBack()}
            style={{ padding: spacing.xs }}
          >
            <Text style={{ ...fonts.bodyStrong, color: c.primary }}>← {t('common.back')}</Text>
          </Pressable>
          <Text style={{ ...fonts.h2, color: c.neutral.text, flex: 1, textAlign: 'center' }}>{t('account.myAccount')}</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
          <Card>
            <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
              <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
                <Text style={{ fontSize: 40 }}>{user.role === 'nurse' ? '🧑‍⚕️' : '🧍'}</Text>
              </View>
              <Text style={{ ...fonts.h1, color: c.neutral.text, fontSize: 24 }}>{name}</Text>
              <Badge label={user.role === 'nurse' ? t('auth.nurse') : t('auth.patient')} variant="info" />
            </View>
            <View style={{ height: 1, backgroundColor: c.neutral.border, marginVertical: spacing.sm }} />

            {loading ? (
              <ActivityIndicator color={c.primary} style={{ paddingVertical: spacing.md }} />
            ) : (
              <>
                {error ? (
                  <Text style={{ ...fonts.caption, color: c.neutral.textMuted, marginBottom: spacing.sm }}>{error}</Text>
                ) : null}
                <InfoRow label={t('auth.phoneNumber')} value={phone || '—'} />
                <InfoRow label={t('details.age')} value={age === null ? '—' : String(age)} />
                <InfoRow label={t('details.sex')} value={sexLabel} />
                {email ? <InfoRow label={t('auth.email')} value={email} /> : null}
                {user.staffId ? <InfoRow label={t('auth.staffId')} value={user.staffId} /> : null}
                {profile?.caseId ? (
                  <InfoRow
                    label={t('account.caseReference')}
                    value={`${profile.caseId.slice(0, 8)}… · ${profile.caseStatus ?? '—'}`}
                  />
                ) : null}
              </>
            )}
          </Card>

          {/* Real clinical intake, read back from the persisted case record. */}
          <Card>
            <Text style={{ ...fonts.h3, color: c.neutral.text, marginBottom: spacing.sm }}>{t('review.symptoms')}</Text>
            {symptoms.length === 0 ? (
              <Text style={{ ...fonts.body, color: c.neutral.textMuted }}>{t('account.noCaseYet')}</Text>
            ) : (
              symptoms.map((s) => (
                <View key={s.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                  <Text style={{ ...fonts.body, color: c.neutral.text, flex: 1 }}>{s.label}</Text>
                  {s.severity ? <Text style={{ ...fonts.caption, color: c.neutral.textMuted }}>{s.severity}/5</Text> : null}
                </View>
              ))
            )}
            {profile?.chiefComplaint ? (
              <Text style={{ ...fonts.caption, color: c.neutral.textMuted, marginTop: spacing.sm }}>
                {t('account.chiefComplaint')}: {profile.chiefComplaint}
              </Text>
            ) : null}
          </Card>

          <Card>
            <Text style={{ ...fonts.h3, color: c.neutral.text, marginBottom: spacing.sm }}>{t('review.followUps')}</Text>
            {answers.length === 0 ? (
              <Text style={{ ...fonts.body, color: c.neutral.textMuted }}>{t('account.noAnswersYet')}</Text>
            ) : (
              answers.map((a) => (
                <View key={a.questionId} style={{ paddingVertical: 6 }}>
                  <Text style={{ ...fonts.body, color: c.neutral.text }}>{a.question}</Text>
                  <Text style={{ ...fonts.caption, color: c.primaryDark }}>{answerLabel(a.answer)}</Text>
                </View>
              ))
            )}
          </Card>

          <Card>
            <Text style={{ ...fonts.h3, color: c.neutral.text, marginBottom: spacing.sm }}>{t('account.settings')}</Text>
            <SettingRow
              icon={<Globe size={20} color={c.neutral.textMuted} strokeWidth={1.75} />}
              label={t('account.language')}
              value={lang === 'sw' ? 'Kiswahili' : 'English'}
            />
            <SettingRow
              icon={<ShieldCheck size={20} color={c.neutral.textMuted} strokeWidth={1.75} />}
              label={t('account.privacy')}
              value={t('account.privacyDesc')}
            />
          </Card>

          <Button
            label={t('account.logout')}
            variant="outline"
            onPress={onLogout}
            icon={<LogOut size={18} color={c.primary} strokeWidth={1.75} />}
            testID="account-sign-out"
          />
        </ScrollView>
      </View>
    </ScreenFade>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { colors: c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 }}>
      <Text style={{ ...fonts.body, color: c.neutral.textMuted }}>{label}</Text>
      <Text style={{ ...fonts.bodyStrong, color: c.neutral.text }}>{value}</Text>
    </View>
  );
}

function SettingRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const { colors: c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
      <View style={{ marginRight: spacing.md }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...fonts.bodyStrong, color: c.neutral.text }}>{label}</Text>
        <Text style={{ ...fonts.caption, color: c.neutral.textMuted }}>{value}</Text>
      </View>
    </View>
  );
}

export default MyAccountScreen;
