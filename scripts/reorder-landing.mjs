import fs from "fs";

const p = "src/components/landing-content.tsx";
let c = fs.readFileSync(p, "utf8");
c = c.replace("      </section>      {/*", "      </section>\n\n      {/*");

const cliStart = c.indexOf("      {/* ━━━ APPLE JUICE CLI ━━━ */}");
const pricingStart = c.indexOf(
  "      {/* ━━━ PRICING (Sleek fully rounded cards",
);
const faqStart = c.indexOf("      {/* ━━━ FAQ (Light Accents Accordion) ━━━ */}");
const exploreStart = c.indexOf('      {/* ━━━ "EXPLORE THE PRODUCT"');
const featuresStart = c.indexOf(
  "      {/* ━━━ CORE FEATURES (THREE COLUMNS ROW) ━━━ */}",
);
const ctaStart = c.indexOf("      {/* ━━━ BOTTOM CALL-TO-ACTION ━━━ */}");

const idxs = {
  cliStart,
  pricingStart,
  faqStart,
  exploreStart,
  featuresStart,
  ctaStart,
};
if (Object.values(idxs).some((i) => i < 0)) {
  console.error("Missing marker", idxs);
  process.exit(1);
}

const faqEnd = c.indexOf("      </section>", faqStart) + "      </section>".length;

const before = c.slice(0, cliStart);
const cliBlock = c.slice(cliStart, pricingStart);
const pricingBlock = c.slice(pricingStart, faqStart);
const faqBlock = c.slice(faqStart, faqEnd);
const exploreBlock = c.slice(exploreStart, featuresStart);
const featuresBlock = c.slice(featuresStart, ctaStart);
const after = c.slice(ctaStart);

const out =
  before +
  exploreBlock +
  featuresBlock +
  cliBlock +
  pricingBlock +
  faqBlock +
  after;
fs.writeFileSync(p, out);
console.log("OK: Hero | Explore | Features | CLI | Pricing | FAQ | CTA");
