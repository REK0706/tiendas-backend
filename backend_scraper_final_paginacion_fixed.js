
import express from 'express';
import puppeteer from 'puppeteer';
import bodyParser from 'body-parser';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.get('/datos', async (req, res) => {
  const { usuario, password } = {
    usuario: 'nacho.puig@ex-gr.com',
    password: 'ExGr2024%'
  };

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    await page.goto('http://212.132.122.69:9001/Identity/Account/Login?returnUrl=/', {
      waitUntil: 'networkidle2',
      timeout: 90000
    });

    await page.type('input[name="Input.Email"]', usuario);
    await page.type('input[name="Input.Password"]', password);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    let allData = [];
    let currentFirstStore = null;

    while (true) {
      await page.waitForFunction(() =>
        document.querySelectorAll('td').length >= 55,
        { timeout: 15000 }
      );

      const pageData = await page.evaluate(() => {
        const cells = Array.from(document.querySelectorAll('td'));
        const datos = [];

        for (let i = 0; i < cells.length; i += 11) {
          const grupo = cells.slice(i, i + 11);
          const tiendaSpan = grupo[1]?.querySelector('span');
          const ventaDiv = grupo[3]?.querySelector('div');
          const nombre = tiendaSpan?.innerText.trim();
          const venta = ventaDiv?.innerText.trim();
          if (nombre && venta) {
            datos.push({ tienda: nombre, venta });
          }
        }

        return datos;
      });

      if (pageData.length === 0) break;

      const firstStore = pageData[0].tienda;
      if (firstStore === currentFirstStore) break;
      currentFirstStore = firstStore;

      allData.push(...pageData);

      const nextButton = await page.$('a.rz-paginator-next:not(.rz-state-disabled)');
      if (nextButton) {
        await nextButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        break;
      }
    }

    await browser.close();
    res.json(allData);
  } catch (err) {
    await browser.close();
    res.status(500).json({ error: 'Error al hacer scraping', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
