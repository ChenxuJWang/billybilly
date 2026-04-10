import { Bot, CreditCard, Smartphone } from 'lucide-react';

export const IMPORT_PLATFORMS = [
  {
    id: 'alipay',
    name: 'Alipay',
    icon: CreditCard,
    sampleFields: ['交易时间', '交易分类', '交易对方', '商品说明', '收/支', '金额', '支付方式', '当前状态'],
    currency: 'CNY',
  },
  {
    id: 'wechat',
    name: 'WeChat Pay',
    icon: Smartphone,
    sampleFields: ['交易时间', '交易类型', '交易对方', '商品', '收/支', '金额(元)', '支付方式', '当前状态'],
    currency: 'CNY',
  },
];

export const CATEGORIZATION_STATUS_LABELS = {
  llm: 'LLM is reviewing transactions',
  rules: 'Applying rules to transactions',
};

export const CATEGORIZATION_EMPTY_MESSAGE = {
  llm: 'Processing...',
  rules: 'Queued...',
};

export const GENERIC_CATEGORIZATION_ICON = Bot;
