const fs = require('fs');
const path = require('path');

const root = process.cwd();
const targets = [
  {
    file: path.join(
      root,
      'node_modules',
      'expo-glass-effect',
      'ios',
      'GlassView.swift'
    ),
    block: `  public override func mountChildComponentView(_ childComponentView: UIView, index: Int) {\n    glassEffectView.contentView.insertSubview(childComponentView, at: index)\n  }\n\n  public override func unmountChildComponentView(_ childComponentView: UIView, index: Int) {\n    childComponentView.removeFromSuperview()\n  }`,
  },
  {
    file: path.join(
      root,
      'node_modules',
      'expo-glass-effect',
      'ios',
      'GlassContainer.swift'
    ),
    block: `  public override func mountChildComponentView(_ childComponentView: UIView, index: Int) {\n    containerEffectView.contentView.insertSubview(childComponentView, at: index)\n  }\n\n  public override func unmountChildComponentView(_ childComponentView: UIView, index: Int) {\n    childComponentView.removeFromSuperview()\n  }`,
  },
];

const wrapBlock = (block) => `  #if RCT_NEW_ARCH_ENABLED\n${block}\n  #endif`;

let patched = false;

for (const target of targets) {
  if (!fs.existsSync(target.file)) {
    continue;
  }

  const source = fs.readFileSync(target.file, 'utf8');
  if (source.includes('#if RCT_NEW_ARCH_ENABLED') || !source.includes(target.block)) {
    continue;
  }

  const next = source.replace(target.block, wrapBlock(target.block));
  fs.writeFileSync(target.file, next);
  patched = true;
}

if (patched) {
  // eslint-disable-next-line no-console
  console.log('Patched expo-glass-effect for classic architecture builds.');
}
