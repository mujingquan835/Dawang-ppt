// JAD-182:theme03 的 per-theme 控件特例描述符(与主题同目录,index.jsx 通用消费)。
import { ICONS as DECOR_ICONS } from './source/src/icons.js';
import { PRESET_3D } from './source/src/preset3d.js';

export const overrides = {
  // 注入的装饰控件 + 全局强调色控件(顺序与原内联一致)
  injectControls: [
    { key: 'showDecor', label: '装饰图片', type: 'toggle', default: false },
    {
      key: 'decorSrc',
      label: '装饰元素',
      type: 'icons',
      default: null,
      options: DECOR_ICONS.map(({ src, label }) => ({ value: src, label, image: src })),
    },
    { key: 'decorScale', label: '图片大小', type: 'range', default: 1, min: 0.6, max: 1.6, step: 0.05 },
    {
      key: 'accent',
      label: '强调色',
      type: 'select',
      default: 'blue',
      options: [
        { value: 'blue', label: '电光蓝' },
        { value: 'lime', label: '荧光绿' },
      ],
    },
  ],
  // 注入前先剔除原页面里同 key 的控件
  replaceKeys: ['accent', 'theme', 'showDecor', 'decorSrc', 'decorScale'],
  injectDefaults: { showDecor: false, decorSrc: null, decorScale: 1, accent: 'blue' },
  preset3dBySlot: PRESET_3D,
  swatchKeys: ['accent'],
};
