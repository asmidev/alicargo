export const ROLE_LABELS: Record<string, string> = {
  'rahbar': 'Rahbar',
  'bosh_admin': 'Bosh Menejer',
  'xitoy_manager': 'Xitoy Filiali Menejeri',
  'xitoy_packer': 'Xitoy Ombor Xodimi',
  'xitoy_receiver': 'Xitoy Qabul Qiluvchi',
  'uz_manager': "O'zbekiston Filiali Menejeri",
  'uz_receiver': "O'zbekiston Ombor Xodimi",
  'uz_quality': "O'zbekiston Sifat Nazorati",
  'moliya_xodimi': 'Moliya Bo\'limi Xodimi',
  'manager': 'Manager',
  'kuryer': 'Kuryer',
  'investor': 'Investor',
};

export const getRoleLabel = (roleValue: string, t?: (key: string) => string): string => {
  if (t) {
    const translated = t(`role_${roleValue}`);
    if (translated !== `role_${roleValue}`) return translated;
  }
  return ROLE_LABELS[roleValue] || roleValue;
};
