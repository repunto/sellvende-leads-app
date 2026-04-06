import fs from 'fs';

const html = `
<!DOCTYPE html>
<html>
<head>
<style>
  body { background: #e8edf2; padding: 50px; }
  .email-container {
    background: #ffffff; maxWidth: 580px; margin: 0 auto;
    border: 1px solid #e2e8f0; borderRadius: 8px;
    padding: 28px 32px; color: #1e293b; font-size: 14px;
    line-height: 1.7;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
</style>
</head>
<body>
  <div class="email-container">
    <p>Puede reservar el tour directamente aquí 👉<a target="_blank" rel="noopener noreferrer" href="https://inkajungletour.com/tour/inka-jungle-premium/" style="color: rgb(59, 130, 246); text-decoration: underline;"><u>Inka Jungle Premium</u></a></p>
  </div>
</body>
</html>
`;

fs.writeFileSync('C:/QuipuReservas/test-layout.html', html);
console.log("HTML generated for inspection.");
