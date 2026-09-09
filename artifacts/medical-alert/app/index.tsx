import React, { useEffect, useMemo, useState } from 'react';
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
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';

type Language = 'en' | 'ar';
type Screen = 'setup' | 'alert';

interface Profile {
  name: string;
  condition: string;
  photoUri: string | null;
  contactName: string;
  contactPhone: string;
}

const PROFILE_KEY = 'medical-alert-profile';
const LANGUAGE_KEY = 'medical-alert-language';

const DEFAULT_PROFILE: Profile = {
  name: 'Nour Ahmed',
  condition: 'Epilepsy',
  photoUri: null,
  contactName: 'Maya Ahmed',
  contactPhone: '+20 10 5555 1488',
};

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
    secureNote: 'Your profile stays on this device until you connect your care service.',
    previewAlert: 'Save & preview alert',
    required: 'Please add your name and condition first.',
    permissionTitle: 'Photo access needed',
    libraryPermission:
      'Allow photo access to choose a picture from your library.',
    cameraPermission: 'Allow camera access to take your profile picture.',
    openSettings: 'Open settings',
    alertEyebrow: 'FOR BYSTANDERS',
    alertTitle: 'This person may need help.',
    alertSubtitle:
      'Stay calm and follow the steps below. Their care team has prepared this profile.',
    verified: 'PROFILE READY',
    conditionLabel: 'CONDITION',
    whatToDo: 'What to do',
    instructionOne: 'Stay with them and keep the area calm.',
    instructionTwo: 'Move nearby objects away. Do not restrain them.',
    instructionThree: 'Time the episode and call for help if it continues.',
    callContact: 'Call emergency contact',
    calling: 'Calling',
    callUnavailable: 'Add an emergency phone number to make calls from the alert screen.',
    editProfile: 'Edit profile',
    private: 'Private by design',
    medicalId: 'Medical ID',
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
    secureNote: 'بياناتك تظل على هذا الجهاز حتى تربط خدمة الرعاية الخاصة بك.',
    previewAlert: 'حفظ ومعاينة شاشة الطوارئ',
    required: 'من فضلك أضف الاسم والحالة الصحية أولاً.',
    permissionTitle: 'نحتاج إلى صلاحية الصور',
    libraryPermission: 'اسمح بالوصول إلى الصور لاختيار صورة من مكتبتك.',
    cameraPermission: 'اسمح بالوصول إلى الكاميرا لالتقاط صورة الملف الشخصي.',
    openSettings: 'فتح الإعدادات',
    alertEyebrow: 'للمساعدة من حولك',
    alertTitle: 'هذا الشخص قد يحتاج إلى مساعدة.',
    alertSubtitle:
      'حافظ على هدوئك واتبع الخطوات التالية. تم تجهيز هذا الملف بواسطة فريق الرعاية.',
    verified: 'الملف جاهز',
    conditionLabel: 'الحالة الصحية',
    whatToDo: 'ما يجب فعله',
    instructionOne: 'ابقَ بجانبه وحافظ على هدوء المكان.',
    instructionTwo: 'أبعد الأشياء القريبة. لا تحاول تقييده.',
    instructionThree: 'احسب مدة النوبة واطلب المساعدة إذا استمرت.',
    callContact: 'اتصال بجهة الطوارئ',
    calling: 'جارٍ الاتصال',
    callUnavailable: 'أضف رقم طوارئ لاستخدام الاتصال من شاشة الطوارئ.',
    editProfile: 'تعديل الملف',
    private: 'خصوصيتك أولاً',
    medicalId: 'ميديكال آي دي',
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
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
          ]}
        >
          <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
            {t.previewAlert}
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
  onLanguageChange,
  onEdit,
  onCall,
}: {
  language: Language;
  profile: Profile;
  onLanguageChange: (language: Language) => void;
  onEdit: () => void;
  onCall: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const t = copy[language];
  const isArabic = language === 'ar';
  const textAlign = isArabic ? 'right' : 'left';

  const instructions = [t.instructionOne, t.instructionTwo, t.instructionThree];

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
          <View style={[styles.alertPill, { backgroundColor: colors.coralSoft }, isArabic && styles.rowReverse]}>
            <View style={[styles.pillDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.alertPillText, { color: colors.accentForeground }]}>
              {t.alertEyebrow}
            </Text>
          </View>
          <Text style={[styles.alertTitle, { color: colors.tealDeep, textAlign }]}>
            {t.alertTitle}
          </Text>
          <Text style={[styles.alertSubtitle, { color: colors.mutedForeground, textAlign }]}>
            {t.alertSubtitle}
          </Text>
        </View>

        <LinearGradient
          colors={[colors.tealDeep, colors.teal]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.alertCard}
        >
          <View style={[styles.alertCardTop, isArabic && styles.rowReverse]}>
            <View style={[styles.readyPill, isArabic && styles.rowReverse]}>
              <Feather name="shield" size={13} color={colors.sage} />
              <Text style={[styles.readyText, { color: colors.sage }]}>{t.verified}</Text>
            </View>
            <MaterialCommunityIcons name="heart-pulse" size={25} color={colors.sage} />
          </View>

          <View style={styles.alertPerson}>
            <View style={[styles.alertAvatarRing, { borderColor: colors.accent }]}>
              <Avatar profile={profile} colors={colors} size={102} />
            </View>
            <Text style={[styles.alertName, { color: colors.primaryForeground, textAlign }]}>
              {profile.name || (isArabic ? 'الاسم غير مضاف' : 'Name not added')}
            </Text>
            <Text style={[styles.alertConditionLabel, { color: colors.sage }]}>
              {t.conditionLabel}
            </Text>
            <Text style={[styles.alertCondition, { color: colors.primaryForeground, textAlign }]}>
              {profile.condition || (isArabic ? 'لم تتم الإضافة' : 'Not added yet')}
            </Text>
          </View>
        </LinearGradient>

        <View style={[styles.instructionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.instructionsHeading, isArabic && styles.rowReverse]}>
            <View style={[styles.instructionsTitleWrap, isArabic && { alignItems: 'flex-end' }]}>
              <Text style={[styles.cardEyebrow, { color: colors.mutedForeground, textAlign }]}>
                {t.medicalId}
              </Text>
              <Text style={[styles.instructionsTitle, { color: colors.tealDeep, textAlign }]}>
                {t.whatToDo}
              </Text>
            </View>
            <IconBadge backgroundColor={colors.sage} size={40}>
              <Feather name="info" size={18} color={colors.teal} />
            </IconBadge>
          </View>

          {instructions.map((instruction, index) => (
            <View key={instruction} style={[styles.instructionRow, isArabic && styles.rowReverse]}>
              <View style={[styles.instructionNumber, { backgroundColor: colors.coralSoft }]}>
                <Text style={[styles.instructionNumberText, { color: colors.primary }]}>
                  {index + 1}
                </Text>
              </View>
              <Text style={[styles.instructionText, { color: colors.tealDeep, textAlign }]}>
                {instruction}
              </Text>
            </View>
          ))}
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

        <View style={[styles.footerTrust, isArabic && styles.rowReverse]}>
          <Feather name="lock" size={14} color={colors.mutedForeground} />
          <Text style={[styles.footerTrustText, { color: colors.mutedForeground }]}>
            {t.private}
          </Text>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

export default function MedicalAlertHome() {
  const [language, setLanguage] = useState<Language>('en');
  const [screen, setScreen] = useState<Screen>('setup');
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [photoMenuVisible, setPhotoMenuVisible] = useState(false);
  const colors = useColors();
  const t = copy[language];

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [storedProfile, storedLanguage] = await Promise.all([
        AsyncStorage.getItem(PROFILE_KEY),
        AsyncStorage.getItem(LANGUAGE_KEY),
      ]);
      if (!active) return;
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
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const handleLanguageChange = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    void AsyncStorage.setItem(LANGUAGE_KEY, nextLanguage);
  };

  const handleSave = async () => {
    if (!profile.name.trim() || !profile.condition.trim()) {
      Alert.alert(t.required);
      return;
    }
    try {
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setScreen('alert');
    } catch {
      Alert.alert(
        language === 'ar' ? 'تعذر حفظ الملف' : 'Could not save profile',
        language === 'ar'
          ? 'حاول مرة أخرى.'
          : 'Please try again.',
      );
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    const phone = profile.contactPhone.trim();
    if (!phone) {
      Alert.alert(t.callUnavailable);
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`);
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

  return screen === 'setup' ? (
    <SetupScreen
      {...sharedProps}
      profile={profile}
      setProfile={setProfile}
      onSave={() => void handleSave()}
      onChoosePhoto={() => void handleChoosePhoto()}
      onTakePhoto={() => void handleTakePhoto()}
      photoMenuVisible={photoMenuVisible}
      setPhotoMenuVisible={setPhotoMenuVisible}
    />
  ) : (
    <AlertScreen
      {...sharedProps}
      profile={profile}
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
    marginTop: 35,
  },
  alertPill: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillDot: {
    borderRadius: 5,
    height: 8,
    width: 8,
  },
  alertPillText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 10,
    letterSpacing: 1,
  },
  alertTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 28,
    letterSpacing: -0.8,
    lineHeight: 37,
    marginTop: 13,
  },
  alertSubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 6,
  },
  alertCard: {
    borderRadius: 27,
    marginTop: 23,
    minHeight: 282,
    overflow: 'hidden',
    padding: 20,
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
    marginTop: 12,
  },
  alertAvatarRing: {
    borderRadius: 62,
    borderWidth: 3,
    padding: 4,
  },
  alertName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 24,
    marginTop: 10,
  },
  alertConditionLabel: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 9,
    letterSpacing: 1.3,
    marginTop: 2,
  },
  alertCondition: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 16,
    marginTop: 1,
  },
  instructionsCard: {
    borderRadius: 23,
    borderWidth: 1,
    marginTop: 16,
    padding: 19,
  },
  instructionsHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 17,
  },
  instructionsTitleWrap: {
    alignItems: 'flex-start',
  },
  instructionsTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 21,
    marginTop: 3,
  },
  instructionRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    marginTop: 13,
  },
  instructionNumber: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  instructionNumberText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  instructionText: {
    flex: 1,
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    lineHeight: 20,
    paddingTop: 2,
  },
  callButton: {
    alignItems: 'center',
    borderRadius: 20,
    flexDirection: 'row',
    marginTop: 16,
    minHeight: 72,
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
  footerTrust: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 18,
  },
  footerTrustText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
  },
});