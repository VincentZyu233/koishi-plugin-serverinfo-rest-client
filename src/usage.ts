const pkg = require('../package.json')

const KOISHI_LOGO_BASE64 = 'data%3Aimage%2Fpng%3Bbase64%2CiVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAABU0lEQVR42p2UQSsFYRSGnxnqLuytKWKpKFkQNsS%2FsOHPWPADLCmxU5S7UzYWNrJR7lYiRF2FeWzOMKZ7mXHqNNP5vvP2nu%2B850CY2lP4X1K31ZbaDm%2BpO%2Bpyp5wfAXVEPfRvO1JHf4AVQGbUh7j4EZ4VkrNCXPVRnf3CUBN1SH2KC28VGOV3ntRhNclZHdcAKYM11QR1oVBOXctzFlNgBTC8qmXxPQEegbVeYApIgJT6tg%2F0AdMp0B%2FBpCabK2AAmAAa%2F2GRBft1oBFPkqTAba7LCiAfQC9wClwAY1HJHepuiO29Yrsf1Dn1uiDU3RTYCtTkl1Leg8k9MB4NGgReI28rV3azgyCz0og01Xl1Uz1QX8uCTELm3UbkTF1VJ9Wr0tn3iBSGdjYG0XivE3VN3VD31PM4a3cc2tIGGI0VkTO7rLxGuiy25ejmjfqsvkSXui62TxaK03td4FXTAAAAAElFTkSuQmCC'

export const usage = `
<h1>🎮 Minecraft BDS 服务器信息查询</h1>
<p><strong>当前版本：v${pkg.version}</strong></p>

<p>
  <a href="https://www.npmjs.com/package/koishi-plugin-ll-serverinfo-rest-client" target="_blank">
    <img src="https://img.shields.io/npm/v/koishi-plugin-ll-serverinfo-rest-client?style=flat-square&logo=npm" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/koishi-plugin-ll-serverinfo-rest-client" target="_blank">
    <img src="https://img.shields.io/npm/dm/koishi-plugin-ll-serverinfo-rest-client?style=flat-square&logo=npm" alt="npm downloads">
  </a>
  <br>
  <a href="https://github.com/VincentZyuApps/koishi-plugin-serverinfo-rest-client/actions" target="_blank">
    <img src="https://github.com/VincentZyuApps/koishi-plugin-serverinfo-rest-client/actions/workflows/test.yml/badge.svg" alt="CI">
  </a>
  <br>
  <a href="https://github.com/VincentZyuApps/koishi-plugin-serverinfo-rest-client" target="_blank">
    <img src="https://img.shields.io/badge/GitHub-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub">
  </a>
  <a href="https://gitee.com/vincent-zyu/koishi-plugin-ll-serverinfo-rest-client" target="_blank">
    <img src="https://img.shields.io/badge/Gitee-C71D23?style=flat-square&logo=gitee&logoColor=white" alt="Gitee">
  </a>
  <br>
  <a href="https://koishi.chat/zh-CN/market/" target="_blank">
    <img src="https://img.shields.io/badge/Koishi-Market-5546A3?style=flat-square&logo=${KOISHI_LOGO_BASE64}&logoColor=white" alt="Koishi Market">
  </a>
  <br>

  <br>
  <a href="https://qm.qq.com/q/ZN7fxZ3qCq" target="_blank">
    <img src="https://img.shields.io/badge/QQ群-1085190201-12B7F5?style=flat-square&logo=qq&logoColor=white" alt="QQ群">
  </a>
  <br>
</p>

<h2>💬 交流反馈</h2>
<p>🐛 Bug 反馈 / 💡 建议 / 👨‍💻 插件开发交流，欢迎加群：</p>
<p><del>💬 插件使用问题 / 🐛 Bug反馈 / 👨‍💻 插件开发交流，欢迎加入QQ群：<b>259248174</b>   🎉（这个群G了）</del></p>
<p>💬 插件使用问题 / 🐛 Bug反馈 / 👨‍💻 插件开发交流，欢迎加入QQ群：<b>1085190201</b> 🎉</p>
<p>💡 在群里直接艾特我，回复的更快哦~ ✨</p>

<p>通过 LeviLamina <code>serverinfo-rest</code> HTTP 服务查询 Minecraft 基岩版服务器，支持服务器状态、TPS、在线与历史玩家、白名单管理和受控命令执行。</p>

`
