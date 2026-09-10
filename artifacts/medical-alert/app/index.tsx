import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { DeviceMotion } from 'expo-sensors';
import { Image } from 'expo-image';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ApiError,
  getGetUserQueryKey,
  useGetUser,
  useSetupUser,
  useTriggerEmergency,
} from '@workspace/api-client-react';
import type { EmergencyResponse, UserProfile } from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { resolveMediaUrl } from '@/lib/config';
import { useColors } from '@/hooks/useColors';

type Language = 'en' | 'ar';
type Screen = 'setup' | 'alert';

interface Profile {
  name: string;
  condition: string;
  photoUri: string | null;
  contactName: string;
  contactPhone: string;
  contactRelation: string;
}

const PROFILE_KEY = 'medical-alert-profile';
const LANGUAGE_KEY = 'medical-alert-language';
const USER_ID_KEY = 'medical-alert-user-id';

const DEFAULT_PROFILE: Profile = {
  name: 'Nour Ahmed',
  condition: 'Epilepsy',
  photoUri: null,
  contactName: 'Maya Ahmed',
  contactPhone: '+20 10 5555 1488',
  contactRelation: 'sister',
};

/** The backend derives the stored extension from the MIME type it receives. */
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

function describePhoto(uri: string) {
  const extension = uri.split(/[?#]/)[0].split('.').pop()?.toLowerCase() ?? '';
  const type = MIME_BY_EXTENSION[extension];
  return type ? { name: `photo.${extension}`, type } : { name: 'photo.jpg', type: 'image/jpeg' };
}

/**
 * Turns a picked image into something `FormData` can upload. On web the picker
 * hands back a blob/data URL that has to be read first; on native, React
 * Native's `FormData` understands the `{ uri, name, type }` shape directly.
 */
async function toPhotoUpload(uri: string): Promise<Blob> {
  const { name, type } = describePhoto(uri);

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob.type ? blob : new Blob([blob], { type });
  }

  return { uri, name, type } as unknown as Blob;
}

function toLocalProfile(user: UserProfile): Profile {
  return {
    name: user.name,
    condition: user.condition,
    photoUri: resolveMediaUrl(user.photoUrl),
    contactName: user.emergencyContact.name,
    contactPhone: user.emergencyContact.phone,
    contactRelation: user.emergencyContact.relation,
  };
}

/** The model returns plain text with one numbered step per line. */
function parseInstructions(text: string | null | undefined): string[] | null {
  if (!text) return null;
  const steps = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return steps.length > 0 ? steps : null;
}

/** Prefers the server's already-translated message over a generic fallback. */
function describeApiError(error: unknown, language: Language) {
  if (error instanceof ApiError) {
    const data = error.data as { error?: string } | null;
    if (data?.error) return data.error;
  }
  return language === 'ar'
    ? 'تعذر الوصول إلى الخادم. تحقق من الاتصال وحاول مرة أخرى.'
    : 'Could not reach the server. Check your connection and try again.';
}


type ConditionDictionaryEntry = {
  en: string;
  ar: string;
  aliases: readonly string[];
};

const CONDITION_DICTIONARY: readonly ConditionDictionaryEntry[] = [
  {
    en: 'Epilepsy',
    ar: 'الصرع',
    aliases: ['epilepsy', 'epileptic', 'seizure', 'seizures', 'seizure disorder', 'الصرع', 'نوبات الصرع', 'تشنجات'],
  },
  {
    en: 'Diabetes',
    ar: 'السكري',
    aliases: ['diabetes', 'diabetic', 'type 1 diabetes', 'type 2 diabetes', 'السكري', 'داء السكري', 'السكر'],
  },
  {
    en: 'Asthma',
    ar: 'الربو',
    aliases: ['asthma', 'asthmatic', 'الربو'],
  },
  {
    en: 'Heart disease',
    ar: 'أمراض القلب',
    aliases: ['heart disease', 'heart condition', 'cardiac disease', 'أمراض القلب', 'مرض القلب'],
  },
  {
    en: 'Allergy',
    ar: 'الحساسية',
    aliases: ['allergy', 'allergies', 'allergic reaction', 'الحساسية', 'حساسية'],
  },
  {
    en: 'Migraine',
    ar: 'الصداع النصفي',
    aliases: ['migraine', 'migraines', 'الصداع النصفي', 'الشقيقة'],
  },
  {
    en: "Alzheimer's disease",
    ar: 'مرض الزهايمر',
    aliases: ["alzheimer's", 'alzheimers', 'alzheimer disease', 'مرض الزهايمر', 'الزهايمر'],
  },
  {
    en: "Parkinson's disease",
    ar: 'مرض باركنسون',
    aliases: ["parkinson's", 'parkinsons', 'parkinson disease', 'مرض باركنسون', 'باركنسون'],
  },
  {
    en: 'Sickle cell disease',
    ar: 'فقر الدم المنجلي',
    aliases: ['sickle cell', 'sickle cell disease', 'فقر الدم المنجلي', 'الانيميا المنجلية'],
  },
  {
    en: 'Kidney disease',
    ar: 'أمراض الكلى',
    aliases: ['kidney disease', 'renal disease', 'أمراض الكلى', 'مرض الكلى'],
  },
  {
    en: 'Bleeding disorder',
    ar: 'اضطراب النزيف',
    aliases: ['bleeding disorder', 'hemophilia', 'haemophilia', 'اضطراب النزيف', 'الهيموفيليا'],
  },
  {
    en: 'Low blood pressure',
    ar: 'انخفاض ضغط الدم',
    aliases: ['low blood pressure', 'hypotension', 'انخفاض ضغط الدم', 'الضغط المنخفض'],
  },
];

function normalizeCondition(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function editDistance(left: string, right: string) {
  const leftCharacters = Array.from(left);
  const rightCharacters = Array.from(right);
  let previousRow = rightCharacters.map((_, index) => index);

  for (let leftIndex = 0; leftIndex < leftCharacters.length; leftIndex += 1) {
    const currentRow = [leftIndex + 1];
    for (let rightIndex = 0; rightIndex < rightCharacters.length; rightIndex += 1) {
      const insertion = currentRow[rightIndex] + 1;
      const deletion = previousRow[rightIndex + 1] + 1;
      const substitution =
        previousRow[rightIndex] + (leftCharacters[leftIndex] === rightCharacters[rightIndex] ? 0 : 1);
      currentRow.push(Math.min(insertion, deletion, substitution));
    }
    previousRow = currentRow;
  }

  return previousRow[rightCharacters.length];
}

function findConditionEntry(value: string) {
  const normalizedValue = normalizeCondition(value);
  if (!normalizedValue) return null;

  let closest: { entry: ConditionDictionaryEntry; distance: number; length: number } | null = null;
  for (const entry of CONDITION_DICTIONARY) {
    const candidates = [entry.en, entry.ar, ...entry.aliases];
    for (const candidate of candidates) {
      const normalizedCandidate = normalizeCondition(candidate);
      const distance = editDistance(normalizedValue, normalizedCandidate);
      if (!closest || distance < closest.distance) {
        closest = { entry, distance, length: Math.max(normalizedValue.length, normalizedCandidate.length) };
      }
      if (distance === 0) return entry;
    }
  }

  if (!closest) return null;
  const relativeDistance = closest.distance / Math.max(closest.length, 1);
  const allowedDistance = closest.length <= 5 ? 1 : Math.max(2, Math.floor(closest.length * 0.28));
  return closest.distance <= allowedDistance || relativeDistance <= 0.28 ? closest.entry : null;
}

function formatCondition(value: string, language: Language) {
  const entry = findConditionEntry(value);
  return entry ? entry[language] : value.trim();
}

const copy = {
  en: {
    appName: 'medical alert',
    language: 'العربية',
    setupEyebrow: 'YOUR SAFETY PROFILE',
    setupTitle: 'Make help feel closer.',
    setupBody:
      'A clear profile helps a bystander support you with confidence when you need it most.',
    step: 'STEP 01 OF 02',
    yourPhoto: 'Your photo',
    photoHint: 'Help people recognize you quickly',
    addPhoto: 'Add a photo',
    changePhoto: 'Change photo',
    photoOptions: 'Choose a photo',
    takePhoto: 'Take a photo',
    chooseFromLibrary: 'Choose from library',
    cancel: 'Cancel',
    fullName: 'Full name',
    namePlaceholder: 'e.g. Nour Ahmed',
    condition: 'Condition',
    conditionPlaceholder: 'e.g. Epilepsy, diabetes...',
    emergencyContact: 'Emergency contact',
    contactName: 'Contact name',
    contactPhone: 'Phone number',
    contactRelation: 'Relationship',
    contactRelationPlaceholder: 'e.g. sister',
    secureNote: 'Your profile is stored on your care server so a bystander always sees the latest guidance.',
    previewAlert: 'Save & preview alert',
    saving: 'Saving…',
    required: 'Please add your name and condition first.',
    photoRequired: 'Please add a photo so a bystander can recognize you.',
    saveFailed: 'Could not save profile',
    permissionTitle: 'Photo access needed',
    libraryPermission:
      'Allow photo access to choose a picture from your library.',
    cameraPermission: 'Allow camera access to take your profile picture.',
    openSettings: 'Open settings',
    alertTitle: 'I have',
    alertSubtitle: 'Keep the area clear and stay with me until help arrives.',
    verified: 'PROFILE READY',
    conditionLabel: 'CONDITION',
    whatToDo: 'What to do',
    extraInstructions: 'Additional guidance',
    instructionOne: 'Stay with them and keep the area calm.',
    instructionTwo: 'Move nearby objects away. Do not restrain them.',
    instructionThree: 'Time the episode and call for help if it continues.',
    callContact: 'Call emergency contact',
    stopSound: 'Stop emergency sound',
    soundStopped: 'Emergency sound stopped',
    calling: 'Calling',
    callUnavailable: 'Add an emergency phone number to make calls from the alert screen.',
    editProfile: 'Edit profile',
    private: 'Private by design',
    medicalId: 'Medical ID',
    shakeToAlert: 'Shake to alert',
    shakeDescription: 'Enable a safety shortcut: three strong jolts in quick succession open the emergency screen.',
    enableShake: 'Enable shake detection',
    shakeEnabled: 'Shake detection enabled',
    shakePermissionTitle: 'Motion access needed',
    shakePermissionBody: 'Allow motion access to use shake-to-alert.',
    shakeUnavailableTitle: 'Motion is unavailable',
    shakeUnavailableBody: 'This device does not expose motion sensors.',
  },
  ar: {
    appName: 'ميديكال أليرت',
    language: 'English',
    setupEyebrow: 'ملف الأمان الخاص بك',
    setupTitle: 'خلّي المساعدة أقرب.',
    setupBody:
      'الملف الواضح يساعد أي شخص حولك على تقديم الدعم بثقة وقت الحاجة.',
    step: 'الخطوة ٠١ من ٠٢',
    yourPhoto: 'صورتك',
    photoHint: 'ساعد الآخرين على التعرّف عليك بسرعة',
    addPhoto: 'إضافة صورة',
    changePhoto: 'تغيير الصورة',
    photoOptions: 'اختار صورة',
    takePhoto: 'التقاط صورة',
    chooseFromLibrary: 'اختيار من الصور',
    cancel: 'إلغاء',
    fullName: 'الاسم بالكامل',
    namePlaceholder: 'مثال: نور أحمد',
    condition: 'الحالة الصحية',
    conditionPlaceholder: 'مثال: الصرع، السكري...',
    emergencyContact: 'جهة اتصال للطوارئ',
    contactName: 'اسم جهة الاتصال',
    contactPhone: 'رقم الهاتف',
    contactRelation: 'صلة القرابة',
    contactRelationPlaceholder: 'مثال: أخت',
    secureNote: 'يتم حفظ ملفك على خادم الرعاية حتى تظهر أحدث الإرشادات لمن يساعدك.',
    previewAlert: 'حفظ ومعاينة شاشة الطوارئ',
    saving: 'جارٍ الحفظ…',
    required: 'من فضلك أضف الاسم والحالة الصحية أولاً.',
    photoRequired: 'من فضلك أضف صورة حتى يتعرف عليك من يساعدك.',
    saveFailed: 'تعذر حفظ الملف',
    permissionTitle: 'نحتاج إلى صلاحية الصور',
    libraryPermission: 'اسمح بالوصول إلى الصور لاختيار صورة من مكتبتك.',
    cameraPermission: 'اسمح بالوصول إلى الكاميرا لالتقاط صورة الملف الشخصي.',
    openSettings: 'فتح الإعدادات',
    alertTitle: 'لدي',
    alertSubtitle: 'أبعد الأشياء من حولي وابقَ بجانبي حتى تصل المساعدة.',
    verified: 'الملف جاهز',
    conditionLabel: 'الحالة الصحية',
    whatToDo: 'ما يجب فعله',
    extraInstructions: 'إرشادات إضافية',
    instructionOne: 'ابقَ بجانبه وحافظ على هدوء المكان.',
    instructionTwo: 'أبعد الأشياء القريبة. لا تحاول تقييده.',
    instructionThree: 'احسب مدة النوبة واطلب المساعدة إذا استمرت.',
    callContact: 'اتصال بجهة الطوارئ',
    stopSound: 'إيقاف صوت الطوارئ',
    soundStopped: 'تم إيقاف صوت الطوارئ',
    calling: 'جارٍ الاتصال',
    callUnavailable: 'أضف رقم طوارئ لاستخدام الاتصال من شاشة الطوارئ.',
    editProfile: 'تعديل الملف',
    private: 'خصوصيتك أولاً',
    medicalId: 'ميديكال آي دي',
    shakeToAlert: 'التنبيه بالهز',
    shakeDescription: 'فعّل اختصار الأمان: ثلاث هزات قوية ومتتالية تفتح شاشة الطوارئ.',
    enableShake: 'تفعيل اكتشاف الهز',
    shakeEnabled: 'اكتشاف الهز مفعّل',
    shakePermissionTitle: 'نحتاج إلى صلاحية الحركة',
    shakePermissionBody: 'اسمح بالوصول إلى الحركة لاستخدام التنبيه بالهز.',
    shakeUnavailableTitle: 'الحركة غير متاحة',
    shakeUnavailableBody: 'هذا الجهاز لا يوفّر مستشعرات للحركة.',
  },
} as const;

function IconBadge({
  children,
  backgroundColor,
  size = 42,
}: {
  children: React.ReactNode;
  backgroundColor: string;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.iconBadge,
        { backgroundColor, width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      {children}
    </View>
  );
}

function LanguageToggle({
  language,
  onChange,
}: {
  language: Language;
  onChange: (language: Language) => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.languageToggle, { backgroundColor: colors.secondary }]}>
      <Pressable
        testID="language-english"
        onPress={() => onChange('en')}
        style={[
          styles.languageOption,
          language === 'en' && { backgroundColor: colors.card },
        ]}
      >
        <Text
          style={[
            styles.languageText,
            { color: language === 'en' ? colors.tealDeep : colors.mutedForeground },
          ]}
        >
          EN
        </Text>
      </Pressable>
      <Pressable
        testID="language-arabic"
        onPress={() => onChange('ar')}
        style={[
          styles.languageOption,
          language === 'ar' && { backgroundColor: colors.card },
        ]}
      >
        <Text
          style={[
            styles.languageText,
            { color: language === 'ar' ? colors.tealDeep : colors.mutedForeground },
          ]}
        >
          عربي
        </Text>
      </Pressable>
    </View>
  );
}

function Avatar({
  profile,
  colors,
  size = 96,
}: {
  profile: Profile;
  colors: ReturnType<typeof useColors>;
  size?: number;
}) {
  const initials = profile.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  if (profile.photoUri) {
    return (
      <Image
        source={{ uri: profile.photoUri }}
        contentFit="cover"
        style={[
          styles.avatarImage,
          {
            backgroundColor: colors.card,
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.avatarFallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.sage,
        },
      ]}
    >
      {initials ? (
        <Text style={[styles.avatarInitials, { color: colors.tealDeep }]}>
          {initials}
        </Text>
      ) : (
        <Feather name="user" size={size * 0.38} color={colors.teal} />
      )}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  textAlign,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad';
  textAlign: 'left' | 'right';
}) {
  const colors = useColors();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.tealDeep, textAlign }]}>
        {label}
      </Text>
      <TextInput
        testID={`field-${label}`}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType}
        selectionColor={colors.primary}
        style={[
          styles.fieldInput,
          {
            color: colors.foreground,
            borderColor: colors.input,
            textAlign,
          },
        ]}
      />
    </View>
  );
}

function SetupScreen({
  language,
  onLanguageChange,
  profile,
  setProfile,
  onSave,
  saving,
  shakeEnabled,
  onEnableShake,
  onChoosePhoto,
  onTakePhoto,
  photoMenuVisible,
  setPhotoMenuVisible,
}: {
  language: Language;
  onLanguageChange: (language: Language) => void;
  profile: Profile;
  setProfile: React.Dispatch<React.SetStateAction<Profile>>;
  onSave: () => void;
  saving: boolean;
  shakeEnabled: boolean;
  onEnableShake: () => void;
  onChoosePhoto: () => void;
  onTakePhoto: () => void;
  photoMenuVisible: boolean;
  setPhotoMenuVisible: (visible: boolean) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const t = copy[language];
  const isArabic = language === 'ar';
  const textAlign = isArabic ? 'right' : 'left';

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 67 : 18) + 8,
            paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 22) + 22,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.topBar, isArabic && styles.rowReverse]}>
          <View style={[styles.brandLockup, isArabic && styles.rowReverse]}>
            <IconBadge backgroundColor={colors.coralSoft} size={38}>
              <MaterialCommunityIcons name="heart-pulse" size={21} color={colors.primary} />
            </IconBadge>
            <Text style={[styles.brandName, { color: colors.tealDeep }]}>
              {t.appName}
            </Text>
          </View>
          <LanguageToggle language={language} onChange={onLanguageChange} />
        </View>

        <View style={[styles.heroCopy, isArabic && { alignItems: 'flex-end' }]}>
          <Text
            style={[
              styles.eyebrow,
              { color: colors.primary, textAlign },
            ]}
          >
            {t.setupEyebrow}
          </Text>
          <Text style={[styles.setupTitle, { color: colors.tealDeep, textAlign }]}>
            {t.setupTitle}
          </Text>
          <Text style={[styles.setupBody, { color: colors.mutedForeground, textAlign }]}>
            {t.setupBody}
          </Text>
        </View>

        <View style={[styles.stepRow, isArabic && styles.rowReverse]}>
          <Text style={[styles.stepText, { color: colors.mutedForeground }]}>
            {t.step}
          </Text>
          <View style={[styles.stepTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.stepProgress, { backgroundColor: colors.primary }]} />
          </View>
        </View>

        <View style={[styles.photoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.photoCopy, isArabic && { alignItems: 'flex-end' }]}>
            <Text style={[styles.cardEyebrow, { color: colors.mutedForeground, textAlign }]}>
              {t.yourPhoto}
            </Text>
            <Text style={[styles.photoHint, { color: colors.tealDeep, textAlign }]}>
              {t.photoHint}
            </Text>
            <Pressable
              testID="photo-button"
              onPress={() => setPhotoMenuVisible(true)}
              style={({ pressed }) => [
                styles.photoAction,
                { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="camera" size={16} color={colors.teal} />
              <Text style={[styles.photoActionText, { color: colors.teal }]}>
                {profile.photoUri ? t.changePhoto : t.addPhoto}
              </Text>
            </Pressable>
          </View>
          <View style={styles.photoFrame}>
            <Avatar profile={profile} colors={colors} size={86} />
              <View
                style={[
                  styles.photoStatus,
                  { backgroundColor: colors.primary, borderColor: colors.card },
                ]}
              >
              <Feather name="check" size={12} color={colors.primaryForeground} />
            </View>
          </View>
        </View>

        <View style={styles.form}>
          <Field
            label={t.fullName}
            value={profile.name}
            onChangeText={(name) => setProfile((current) => ({ ...current, name }))}
            placeholder={t.namePlaceholder}
            textAlign={textAlign}
          />
          <Field
            label={t.condition}
            value={profile.condition}
            onChangeText={(condition) => setProfile((current) => ({ ...current, condition }))}
            placeholder={t.conditionPlaceholder}
            textAlign={textAlign}
          />

          <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
          <View style={[styles.sectionHeading, isArabic && styles.rowReverse]}>
            <View style={[styles.sectionHeadingCopy, isArabic && { alignItems: 'flex-end' }]}>
              <Text style={[styles.cardEyebrow, { color: colors.mutedForeground, textAlign }]}>
                {t.emergencyContact}
              </Text>
              <Text style={[styles.contactHelper, { color: colors.mutedForeground, textAlign }]}>
                {isArabic ? 'سيظهر هذا الرقم في شاشة الطوارئ' : 'Shown on the emergency screen'}
              </Text>
            </View>
            <IconBadge backgroundColor={colors.coralSoft} size={34}>
              <Feather name="phone" size={15} color={colors.primary} />
            </IconBadge>
          </View>
          <Field
            label={t.contactName}
            value={profile.contactName}
            onChangeText={(contactName) =>
              setProfile((current) => ({ ...current, contactName }))
            }
            placeholder={isArabic ? 'مثال: مريم أحمد' : 'e.g. Maya Ahmed'}
            textAlign={textAlign}
          />
          <Field
            label={t.contactPhone}
            value={profile.contactPhone}
            onChangeText={(contactPhone) =>
              setProfile((current) => ({ ...current, contactPhone }))
            }
            placeholder="+20 10 0000 0000"
            keyboardType="phone-pad"
            textAlign={textAlign}
          />
          <Field
            label={t.contactRelation}
            value={profile.contactRelation}
            onChangeText={(contactRelation) =>
              setProfile((current) => ({ ...current, contactRelation }))
            }
            placeholder={t.contactRelationPlaceholder}
            textAlign={textAlign}
          />
        </View>

        <View
          style={[
            styles.shakeCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.shakeCardHeader, isArabic && styles.rowReverse]}>
            <IconBadge backgroundColor={colors.coralSoft} size={38}>
              <MaterialCommunityIcons name="gesture-swipe" size={19} color={colors.primary} />
            </IconBadge>
            <View style={[styles.shakeCardCopy, isArabic && { alignItems: 'flex-end' }]}>
              <Text style={[styles.shakeCardTitle, { color: colors.tealDeep, textAlign }]}>
                {t.shakeToAlert}
              </Text>
              <Text style={[styles.shakeCardDescription, { color: colors.mutedForeground, textAlign }]}>
                {t.shakeDescription}
              </Text>
            </View>
          </View>
          <Pressable
            testID="enable-shake"
            onPress={onEnableShake}
            style={({ pressed }) => [
              styles.shakeButton,
              {
                backgroundColor: shakeEnabled ? colors.sage : colors.secondary,
                opacity: pressed ? 0.72 : 1,
              },
            ]}
          >
            <Feather
              name={shakeEnabled ? 'check-circle' : 'activity'}
              size={16}
              color={shakeEnabled ? colors.teal : colors.primary}
            />
            <Text style={[styles.shakeButtonText, { color: shakeEnabled ? colors.teal : colors.primary }]}>
              {shakeEnabled ? t.shakeEnabled : t.enableShake}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.noteRow, isArabic && styles.rowReverse]}>
          <Feather name="lock" size={15} color={colors.mutedForeground} />
          <Text style={[styles.noteText, { color: colors.mutedForeground, textAlign }]}>
            {t.secureNote}
          </Text>
        </View>

        <Pressable
          testID="save-profile"
          onPress={onSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.primary, opacity: pressed || saving ? 0.82 : 1 },
          ]}
        >
          <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
            {saving ? t.saving : t.previewAlert}
          </Text>
          <Feather
            name={isArabic ? 'arrow-left' : 'arrow-right'}
            size={19}
            color={colors.primaryForeground}
          />
        </Pressable>
      </KeyboardAwareScrollViewCompat>

      <Modal
        visible={photoMenuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPhotoMenuVisible(false)}
      >
        <Pressable
          style={[styles.modalBackdrop, { backgroundColor: colors.scrim }]}
          onPress={() => setPhotoMenuVisible(false)}
        >
          <Pressable
            style={[styles.photoSheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 18) }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.tealDeep, textAlign }]}>
              {t.photoOptions}
            </Text>
            <Pressable
              testID="take-photo"
              onPress={onTakePhoto}
              style={({ pressed }) => [
                styles.sheetAction,
                { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <IconBadge backgroundColor={colors.coralSoft} size={42}>
                <Feather name="camera" size={19} color={colors.primary} />
              </IconBadge>
              <Text style={[styles.sheetActionText, { color: colors.tealDeep }]}>
                {t.takePhoto}
              </Text>
              <Feather name={isArabic ? 'chevron-left' : 'chevron-right'} size={18} color={colors.mutedForeground} />
            </Pressable>
            <Pressable
              testID="choose-photo"
              onPress={onChoosePhoto}
              style={({ pressed }) => [
                styles.sheetAction,
                { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <IconBadge backgroundColor={colors.sage} size={42}>
                <Feather name="image" size={19} color={colors.teal} />
              </IconBadge>
              <Text style={[styles.sheetActionText, { color: colors.tealDeep }]}>
                {t.chooseFromLibrary}
              </Text>
              <Feather name={isArabic ? 'chevron-left' : 'chevron-right'} size={18} color={colors.mutedForeground} />
            </Pressable>
            <Pressable
              testID="cancel-photo"
              onPress={() => setPhotoMenuVisible(false)}
              style={({ pressed }) => [styles.cancelButton, { opacity: pressed ? 0.65 : 1 }]}
            >
              <Text style={[styles.cancelButtonText, { color: colors.mutedForeground }]}>
                {t.cancel}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function AlertScreen({
  language,
  profile,
  isAlertActive,
  instructions,
  onLanguageChange,
  onEdit,
  onCall,
}: {
  language: Language;
  profile: Profile;
  isAlertActive: boolean;
  instructions: string[] | null;
  onLanguageChange: (language: Language) => void;
  onEdit: () => void;
  onCall: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const t = copy[language];
  const sirenSource = useMemo(
    () => require('../assets/audio/emergency-siren.mp3'),
    [],
  );
  const sirenPlayer = useAudioPlayer(sirenSource);
  const sirenPlayerRef = useRef(sirenPlayer);
  sirenPlayerRef.current = sirenPlayer;
  const [sirenPlaying, setSirenPlaying] = useState(true);
  const isArabic = language === 'ar';
  const textAlign = isArabic ? 'right' : 'left';

  const condition =
    formatCondition(profile.condition, language) ||
    (isArabic ? 'حالة صحية' : 'a medical condition');
  // Replace this local starter copy with the concise instruction returned by the LLM.
  const bystanderInstruction = t.alertSubtitle;
  // The backend returns the model's numbered steps; the local copy is the
  // fallback while they are still being generated or the server is offline.
  const extraInstructions =
    instructions && instructions.length > 0
      ? instructions
      : [t.instructionOne, t.instructionTwo, t.instructionThree];

  useEffect(() => {
    if (!isAlertActive) return;

    let active = true;
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
    }).then(() => {
      if (!active) return;
      const player = sirenPlayerRef.current;
      try {
        player.loop = true;
        player.volume = 1;
        player.play();
      } catch {
        // The player may be released while the alert screen is closing.
      }
    }).catch(() => {
      // Audio can be blocked by browser autoplay policies; the stop control remains safe.
    });

    return () => {
      active = false;
      try {
        const player = sirenPlayerRef.current;
        if (player?.isLoaded) {
          player.pause();
          void player.seekTo(0).catch(() => {});
        }
      } catch {
        // expo-audio can finish releasing the player before React cleanup runs.
      }
    };
  }, [isAlertActive]);

  const stopSiren = () => {
    try {
      const player = sirenPlayerRef.current;
      if (player?.isLoaded) {
        player.pause();
        void player.seekTo(0).catch(() => {});
      }
    } catch {
      // Keep the emergency screen usable if audio has already been released.
    }
    setSirenPlaying(false);
  };

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.fixedAlertContent,
          {
            paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 67 : 18) + 8,
            paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 22) + 12,
          },
        ]}
      >
        <View style={[styles.topBar, isArabic && styles.rowReverse]}>
          <Pressable
            testID="edit-profile"
            onPress={onEdit}
            style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Feather name={isArabic ? 'arrow-right' : 'arrow-left'} size={20} color={colors.tealDeep} />
            <Text style={[styles.backButtonText, { color: colors.tealDeep }]}>
              {t.editProfile}
            </Text>
          </Pressable>
          <LanguageToggle language={language} onChange={onLanguageChange} />
        </View>

        <View style={[styles.alertIntro, isArabic && { alignItems: 'flex-end' }]}>
          <Text style={[styles.alertTitle, { color: colors.tealDeep, textAlign }]}>
            {t.alertTitle} {condition}
          </Text>
          <Text style={[styles.alertSubtitle, { color: colors.mutedForeground, textAlign }]}>
            {bystanderInstruction}
          </Text>
        </View>

        <View style={[styles.alertCard, { backgroundColor: colors.primary }]}>
          <View style={[styles.alertCardTop, isArabic && styles.rowReverse]}>
            <MaterialCommunityIcons name="heart-pulse" size={25} color={colors.coralSoft} />
          </View>
          <View style={styles.alertPerson}>
            <View style={[styles.alertAvatarRing, { borderColor: colors.coralSoft }]}>
              <Avatar profile={profile} colors={colors} size={78} />
            </View>
            <Text style={[styles.alertName, { color: colors.primaryForeground, textAlign }]}>
              {profile.name || (isArabic ? 'الاسم غير مضاف' : 'Name not added')}
            </Text>
          </View>
        </View>

        <Pressable
          testID="call-emergency-contact"
          onPress={onCall}
          style={({ pressed }) => [
            styles.callButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
          ]}
        >
          <IconBadge backgroundColor={colors.primaryForeground} size={42}>
            <Feather name="phone-call" size={19} color={colors.primary} />
          </IconBadge>
          <View style={[styles.callButtonCopy, isArabic && { alignItems: 'flex-end' }]}>
            <Text style={[styles.callButtonLabel, { color: colors.primaryForeground }]}>
              {t.callContact}
            </Text>
            <Text style={[styles.callButtonContact, { color: colors.coralSoft, textAlign }]}>
              {profile.contactName || (isArabic ? 'جهة اتصال للطوارئ' : 'Emergency contact')}
            </Text>
          </View>
          <Feather name={isArabic ? 'arrow-left' : 'arrow-right'} size={20} color={colors.primaryForeground} />
        </Pressable>

        <View
          style={[
            styles.extraInstructionsCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.extraInstructionsHeader, isArabic && styles.rowReverse]}>
            <IconBadge backgroundColor={colors.sage} size={32}>
              <Feather name="info" size={15} color={colors.teal} />
            </IconBadge>
            <Text
              style={[
                styles.extraInstructionsTitle,
                { color: colors.tealDeep, textAlign },
              ]}
            >
              {t.extraInstructions}
            </Text>
          </View>
          {extraInstructions.map((instruction) => (
            <View
              key={instruction}
              style={[styles.extraInstructionRow, isArabic && styles.rowReverse]}
            >
              <View style={[styles.extraInstructionDot, { backgroundColor: colors.primary }]} />
              <Text
                style={[
                  styles.extraInstructionText,
                  { color: colors.mutedForeground, textAlign },
                ]}
              >
                {instruction}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.footerTrust, isArabic && styles.rowReverse]}>
          <Feather name="lock" size={14} color={colors.mutedForeground} />
          <Text style={[styles.footerTrustText, { color: colors.mutedForeground }]}>
            {t.private}
          </Text>
        </View>

        <Pressable
          testID="stop-emergency-sound"
          accessibilityRole="button"
          accessibilityLabel={sirenPlaying ? t.stopSound : t.soundStopped}
          disabled={!sirenPlaying}
          onPress={stopSiren}
          style={({ pressed }) => [
            styles.stopSoundButton,
            {
              borderColor: colors.border,
              opacity: pressed ? 0.65 : sirenPlaying ? 1 : 0.55,
            },
          ]}
        >
          <Feather name="volume-x" size={15} color={colors.mutedForeground} />
          <Text style={[styles.stopSoundText, { color: colors.mutedForeground }]}>
            {sirenPlaying ? t.stopSound : t.soundStopped}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function MedicalAlertHome() {
  const [language, setLanguage] = useState<Language>('en');
  const [screen, setScreen] = useState<Screen>('setup');
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [userId, setUserId] = useState<string | null>(null);
  const [emergency, setEmergency] = useState<EmergencyResponse | null>(null);
  const [photoMenuVisible, setPhotoMenuVisible] = useState(false);
  const [shakeEnabled, setShakeEnabled] = useState(false);
  const shakeTimesRef = useRef<number[]>([]);
  const lastMagnitudeRef = useRef<number | null>(null);
  const lastTriggerRef = useRef(0);
  const openAlertRef = useRef<(id: string | null) => void>(() => {});
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = userId;
  const colors = useColors();
  const t = copy[language];

  const setupMutation = useSetupUser();
  const emergencyMutation = useTriggerEmergency();
  const profileQuery = useGetUser(userId ?? '', {
    query: {
      queryKey: getGetUserQueryKey(userId ?? ''),
      enabled: Boolean(userId),
    },
  });

  useEffect(() => {
    if (!shakeEnabled) {
      lastMagnitudeRef.current = null;
      shakeTimesRef.current = [];
      return;
    }

    const registerMotionSample = (x: number, y: number, z: number) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const previousMagnitude = lastMagnitudeRef.current;
      lastMagnitudeRef.current = magnitude;

      if (previousMagnitude === null) return;

      const rapidChange = Math.abs(magnitude - previousMagnitude);
      const isHighAccelerationJolt = magnitude >= 15 && rapidChange >= 4;
      if (!isHighAccelerationJolt) return;

      const now = Date.now();
      const recentJolts = shakeTimesRef.current.filter((time) => now - time <= 1600);
      recentJolts.push(now);
      shakeTimesRef.current = recentJolts;

      const cooldownElapsed = now - lastTriggerRef.current > 5000;
      if (recentJolts.length >= 3 && cooldownElapsed) {
        lastTriggerRef.current = now;
        shakeTimesRef.current = [];
        openAlertRef.current(userIdRef.current);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    };

    if (Platform.OS === 'web') {
      const browserMotionEvent = (
        globalThis as typeof globalThis & {
          DeviceMotionEvent?: {
            requestPermission?: () => Promise<'granted' | 'denied'>;
          };
        }
      ).DeviceMotionEvent;

      const handleBrowserMotion = (event: DeviceMotionEvent) => {
        const acceleration = event.acceleration ?? event.accelerationIncludingGravity;
        if (acceleration) {
          registerMotionSample(
            acceleration.x ?? 0,
            acceleration.y ?? 0,
            acceleration.z ?? 0,
          );
        }
      };

      window.addEventListener('devicemotion', handleBrowserMotion);
      return () => window.removeEventListener('devicemotion', handleBrowserMotion);
    }

    DeviceMotion.setUpdateInterval(100);
    const subscription = DeviceMotion.addListener((measurement) => {
      const acceleration =
        measurement.acceleration ?? measurement.accelerationIncludingGravity;
      registerMotionSample(acceleration.x, acceleration.y, acceleration.z);
    });

    return () => subscription.remove();
  }, [shakeEnabled]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [storedProfile, storedLanguage, storedUserId] = await Promise.all([
        AsyncStorage.getItem(PROFILE_KEY),
        AsyncStorage.getItem(LANGUAGE_KEY),
        AsyncStorage.getItem(USER_ID_KEY),
      ]);
      if (!active) return;
      // The cached copy renders instantly and keeps the demo usable offline;
      // the server profile replaces it as soon as the query resolves.
      if (storedProfile) {
        try {
          setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(storedProfile) });
          setScreen('alert');
        } catch {
          setProfile(DEFAULT_PROFILE);
        }
      }
      if (storedLanguage === 'ar' || storedLanguage === 'en') {
        setLanguage(storedLanguage);
      }
      if (storedUserId) {
        setUserId(storedUserId);
        setScreen('alert');
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const serverProfile = profileQuery.data?.user;
  useEffect(() => {
    if (!serverProfile) return;
    const next = toLocalProfile(serverProfile);
    setProfile(next);
    void AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  }, [serverProfile]);

  /**
   * Shows the emergency screen straight away, then asks the backend for the
   * instructions and contact details. A failed request never blocks the
   * screen: it falls back to the cached profile and the local call button.
   */
  const openAlert = useCallback(
    (id: string | null) => {
      setScreen('alert');
      if (!id) return;
      emergencyMutation.mutate(
        { data: { userId: id } },
        {
          onSuccess: (response) => setEmergency(response),
          onError: (error) => {
            console.warn('[medical-alert] emergency trigger failed:', error);
          },
        },
      );
    },
    [emergencyMutation],
  );
  openAlertRef.current = openAlert;

  const handleLanguageChange = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    void AsyncStorage.setItem(LANGUAGE_KEY, nextLanguage);
  };

  const handleEnableShake = async () => {
    if (shakeEnabled) {
      setShakeEnabled(false);
      return;
    }

    try {
      if (Platform.OS === 'web') {
        const browserMotionEvent = (
          globalThis as typeof globalThis & {
            DeviceMotionEvent?: {
              requestPermission?: () => Promise<'granted' | 'denied'>;
            };
          }
        ).DeviceMotionEvent;

        if (browserMotionEvent?.requestPermission) {
          const permission = await browserMotionEvent.requestPermission();
          if (permission !== 'granted') {
            Alert.alert(t.shakePermissionTitle, t.shakePermissionBody);
            return;
          }
        }
      } else {
        const permission = await DeviceMotion.requestPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(t.shakePermissionTitle, t.shakePermissionBody);
          return;
        }
      }

      const available = await DeviceMotion.isAvailableAsync();
      if (!available) {
        Alert.alert(t.shakeUnavailableTitle, t.shakeUnavailableBody);
        return;
      }

      shakeTimesRef.current = [];
      lastMagnitudeRef.current = null;
      setShakeEnabled(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(t.shakePermissionTitle, t.shakePermissionBody);
    }
  };

  const handleSave = async () => {
    if (!profile.name.trim() || !profile.condition.trim()) {
      Alert.alert(t.required);
      return;
    }
    if (!profile.photoUri) {
      Alert.alert(t.photoRequired);
      return;
    }
    try {
      const photo = await toPhotoUpload(profile.photoUri);
      const response = await setupMutation.mutateAsync({
        data: {
          photo,
          name: profile.name.trim(),
          condition: profile.condition.trim(),
          language,
          contactName: profile.contactName.trim(),
          contactPhone: profile.contactPhone.trim(),
          contactRelation: profile.contactRelation.trim(),
        },
      });

      const saved = toLocalProfile(response.user);
      setProfile(saved);
      setUserId(response.user.id);
      setEmergency(null);
      await AsyncStorage.multiSet([
        [USER_ID_KEY, response.user.id],
        [PROFILE_KEY, JSON.stringify(saved)],
      ]);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      openAlert(response.user.id);
    } catch (error) {
      Alert.alert(t.saveFailed, describeApiError(error, language));
    }
  };

  const showPermissionSettings = (message: string, permission: ImagePicker.PermissionResponse) => {
    if (!permission.canAskAgain && Platform.OS !== 'web') {
      Alert.alert(t.permissionTitle, message, [
        { text: t.cancel, style: 'cancel' },
        { text: t.openSettings, onPress: () => void Linking.openSettings() },
      ]);
      return;
    }
    Alert.alert(t.permissionTitle, message, [{ text: t.cancel, style: 'cancel' }]);
  };

  const handleChoosePhoto = async () => {
    setPhotoMenuVisible(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showPermissionSettings(t.libraryPermission, permission);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setProfile((current) => ({ ...current, photoUri: result.assets[0].uri }));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleTakePhoto = async () => {
    setPhotoMenuVisible(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showPermissionSettings(t.cameraPermission, permission);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setProfile((current) => ({ ...current, photoUri: result.assets[0].uri }));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleCall = async () => {
    // The backend hands back a ready-to-dial URI; the typed number is the
    // fallback when the emergency request has not resolved.
    const telUri = emergency?.emergencyContact.telUri;
    const phone = profile.contactPhone.trim();
    if (!telUri && !phone) {
      Alert.alert(t.callUnavailable);
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Linking.openURL(telUri ?? `tel:${phone.replace(/[^\d+]/g, '')}`);
    } catch {
      Alert.alert(
        language === 'ar' ? 'تعذر بدء الاتصال' : 'Could not start the call',
        language === 'ar'
          ? 'تحقق من رقم جهة الطوارئ.'
          : 'Please check the emergency contact number.',
      );
    }
  };

  const sharedProps = useMemo(
    () => ({
      language,
      onLanguageChange: handleLanguageChange,
    }),
    [language],
  );

  const instructions = useMemo(
    () => parseInstructions(emergency?.instructions ?? serverProfile?.instructions),
    [emergency?.instructions, serverProfile?.instructions],
  );

  return screen === 'setup' ? (
    <SetupScreen
      {...sharedProps}
      profile={profile}
      setProfile={setProfile}
      onSave={() => void handleSave()}
      saving={setupMutation.isPending}
      shakeEnabled={shakeEnabled}
      onEnableShake={() => void handleEnableShake()}
      onChoosePhoto={() => void handleChoosePhoto()}
      onTakePhoto={() => void handleTakePhoto()}
      photoMenuVisible={photoMenuVisible}
      setPhotoMenuVisible={setPhotoMenuVisible}
    />
  ) : (
    <AlertScreen
      {...sharedProps}
      profile={profile}
      isAlertActive={screen === 'alert'}
      instructions={instructions}
      onEdit={() => setScreen('setup')}
      onCall={() => void handleCall()}
    />
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
  },
  fixedAlertContent: {
    flex: 1,
    paddingHorizontal: 22,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  brandLockup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  brandName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 17,
    letterSpacing: -0.35,
  },
  iconBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageToggle: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 2,
    padding: 3,
  },
  languageOption: {
    alignItems: 'center',
    borderRadius: 15,
    minWidth: 38,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  languageText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
  },
  heroCopy: {
    marginTop: 42,
  },
  eyebrow: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
    letterSpacing: 1.5,
  },
  setupTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 32,
    letterSpacing: -1.3,
    lineHeight: 40,
    marginTop: 8,
  },
  setupBody: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 15,
    lineHeight: 24,
    marginTop: 8,
    maxWidth: 340,
  },
  stepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
    marginTop: 28,
  },
  stepText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 10,
    letterSpacing: 1.1,
  },
  stepTrack: {
    borderRadius: 4,
    flex: 1,
    height: 5,
    overflow: 'hidden',
  },
  stepProgress: {
    borderRadius: 4,
    height: '100%',
    width: '50%',
  },
  photoCard: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 25,
    minHeight: 142,
    padding: 18,
  },
  photoCopy: {
    alignItems: 'flex-start',
    flex: 1,
  },
  cardEyebrow: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  photoHint: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 5,
    maxWidth: 180,
  },
  photoAction: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 7,
    marginTop: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  photoActionText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  photoFrame: {
    marginLeft: 14,
    position: 'relative',
  },
  avatarImage: {
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 27,
  },
  photoStatus: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    bottom: 1,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    width: 24,
  },
  form: {
    marginTop: 26,
  },
  shakeCard: {
    borderRadius: 21,
    borderWidth: 1,
    marginTop: 2,
    padding: 14,
  },
  shakeCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  shakeCardCopy: {
    alignItems: 'flex-start',
    flex: 1,
  },
  shakeCardTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  shakeCardDescription: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 2,
  },
  shakeButton: {
    alignItems: 'center',
    borderRadius: 13,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  shakeButtonText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  fieldWrap: {
    marginBottom: 17,
  },
  fieldLabel: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    marginBottom: 7,
  },
  fieldInput: {
    borderRadius: 15,
    borderWidth: 1,
    fontFamily: 'Cairo_400Regular',
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  sectionDivider: {
    height: 1,
    marginBottom: 22,
    marginTop: 3,
  },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 17,
  },
  sectionHeadingCopy: {
    alignItems: 'flex-start',
  },
  contactHelper: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    marginTop: 2,
  },
  noteRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 19,
    marginTop: 4,
  },
  noteText: {
    flex: 1,
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    lineHeight: 17,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 17,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    marginRight: 11,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  photoSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    borderRadius: 4,
    height: 4,
    marginBottom: 19,
    width: 42,
  },
  sheetTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 21,
    marginBottom: 16,
  },
  sheetAction: {
    alignItems: 'center',
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    padding: 11,
  },
  sheetActionText: {
    flex: 1,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    marginHorizontal: 12,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 15,
  },
  cancelButtonText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
  },
  backButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    paddingVertical: 7,
  },
  backButtonText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  alertIntro: {
    alignItems: 'flex-start',
    marginTop: 22,
  },
  alertTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 26,
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  alertSubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  alertCard: {
    borderRadius: 27,
    marginTop: 16,
    minHeight: 195,
    overflow: 'hidden',
    padding: 14,
  },
  alertCardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  readyPill: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  readyText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 10,
    letterSpacing: 1.1,
  },
  alertPerson: {
    alignItems: 'center',
    marginTop: 4,
  },
  alertAvatarRing: {
    borderRadius: 62,
    borderWidth: 3,
    padding: 4,
  },
  alertName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 19,
    marginTop: 6,
  },
  callButton: {
    alignItems: 'center',
    borderRadius: 20,
    flexDirection: 'row',
    marginTop: 13,
    minHeight: 62,
    paddingHorizontal: 14,
  },
  callButtonCopy: {
    alignItems: 'flex-start',
    flex: 1,
    marginHorizontal: 11,
  },
  callButtonLabel: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
  },
  callButtonContact: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    marginTop: 1,
  },
  extraInstructionsCard: {
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 11,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  extraInstructionsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    marginBottom: 4,
  },
  extraInstructionsTitle: {
    flex: 1,
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  extraInstructionRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 9,
    marginTop: 4,
  },
  extraInstructionDot: {
    borderRadius: 3,
    height: 6,
    marginTop: 7,
    width: 6,
  },
  extraInstructionText: {
    flex: 1,
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    lineHeight: 19,
  },
  footerTrust: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  footerTrustText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
  },
  stopSoundButton: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 42,
    paddingHorizontal: 14,
  },
  stopSoundText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
});