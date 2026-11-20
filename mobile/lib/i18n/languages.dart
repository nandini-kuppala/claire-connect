// The ten app languages, shown by their native names.
class AppLanguage {
  const AppLanguage(this.code, this.native, this.english);
  final String code;
  final String native;
  final String english;
}

const List<AppLanguage> kLanguages = [
  AppLanguage('ta', 'தமிழ்', 'Tamil'),
  AppLanguage('hi', 'हिन्दी', 'Hindi'),
  AppLanguage('en', 'English', 'English'),
  AppLanguage('te', 'తెలుగు', 'Telugu'),
  AppLanguage('kn', 'ಕನ್ನಡ', 'Kannada'),
  AppLanguage('ml', 'മലയാളം', 'Malayalam'),
  AppLanguage('bn', 'বাংলা', 'Bengali'),
  AppLanguage('or', 'ଓଡ଼ିଆ', 'Odia'),
  AppLanguage('mr', 'मराठी', 'Marathi'),
  AppLanguage('gu', 'ગુજરાતી', 'Gujarati'),
];

String langNative(String? code) {
  for (final l in kLanguages) {
    if (l.code == code) return l.native;
  }
  return code ?? '';
}
