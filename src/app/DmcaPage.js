"use client";

// src/app/DmcaPage.js  : DMCA / copyright policy (opens at /?page=dmca, linked from the footer)
//
// >>> BEFORE YOU PUBLISH: change CONTACT_EMAIL to a mailbox you really read. <<<
// This is a general template, NOT legal advice. Ask a lawyer to check it for your country.

const SITE_NAME = "CineLabz";
const CONTACT_EMAIL = "dmca@yourdomain.com"; // <-- change this
const LAST_UPDATED = "October 2026";

const Section = ({ title, children }) => (
  <section className="space-y-3">
    <h2 className="text-lg sm:text-xl font-black text-white">{title}</h2>
    <div className="space-y-3 text-sm sm:text-base text-gray-300 leading-relaxed">{children}</div>
  </section>
);

const List = ({ items }) => (
  <ol className="list-decimal pl-5 space-y-2 marker:text-red-500 marker:font-bold">
    {items.map((t) => (
      <li key={t}>{t}</li>
    ))}
  </ol>
);

export default function DmcaPage({ onBack }) {
  return (
    <div className="pt-28 sm:pt-36 max-w-3xl w-full min-w-0 mx-auto px-4 sm:px-6 pb-16 space-y-8">
      <button onClick={onBack} className="bg-white/10 hover:bg-white/20 border border-white/10 px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 cursor-pointer transition">
        ← Back to Home
      </button>

      <div>
        <p className="text-red-500 font-bold text-xs uppercase tracking-widest mb-1">Copyright</p>
        <h1 className="text-3xl sm:text-4xl font-black">DMCA Policy</h1>
        <p className="text-gray-500 text-xs mt-2">Last updated: {LAST_UPDATED}</p>
      </div>

      <div className="bg-neutral-900/60 border border-white/10 rounded-3xl p-5 sm:p-8 space-y-8">
        <Section title="Our approach">
          <p>
            {SITE_NAME} respects the intellectual property rights of others and expects its users to do the same. We respond to
            notices of alleged copyright infringement that comply with the Digital Millennium Copyright Act (DMCA, 17 U.S.C. § 512)
            and other applicable laws.
          </p>
          <p>
            If you are a copyright owner (or authorised to act for one) and you believe that material available through {SITE_NAME}{" "}
            infringes your rights, please send us a notice as described below. When we receive a valid notice we will act quickly,
            which may include removing or disabling access to the material.
          </p>
        </Section>

        <Section title="How to send a takedown notice">
          <p>Your written notice must include all of the following:</p>
          <List
            items={[
              "Your physical or electronic signature (a typed full name is fine).",
              "A description of the copyrighted work you say has been infringed (for example the title of the film or series).",
              "The exact web address (URL) of the page on our site where the material appears, so we can find it. For example a link like /?movie=... .",
              "Your name, postal address, telephone number and email address.",
              "A statement that you have a good-faith belief that the use is not authorised by the copyright owner, its agent or the law.",
              "A statement, made under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or are authorised to act on the owner's behalf.",
            ]}
          />
          <p>Send the notice by email to:</p>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("DMCA takedown notice")}`}
            className="inline-block bg-red-600/15 border border-red-600/40 text-red-400 hover:bg-red-600 hover:text-white px-5 py-2.5 rounded-xl text-sm font-bold transition"
          >
            {CONTACT_EMAIL}
          </a>
          <p className="text-xs text-gray-500">Please use the subject line “DMCA takedown notice”. Incomplete notices may be delayed while we ask for more information.</p>
        </Section>

        <Section title="What happens next">
          <List
            items={[
              "We review the notice and, if it is complete, remove or disable access to the material.",
              "We may tell the person who added the material that it was removed and give them a copy of the notice.",
              "If you tell us the notice was a mistake, or the person who added the material sends a valid counter-notice, we will follow the process in the law.",
            ]}
          />
        </Section>

        <Section title="Counter-notification">
          <p>
            If you believe material was removed by mistake or misidentification, you can send us a counter-notice with: your signature;
            a description of the removed material and where it appeared before removal; a statement under penalty of perjury that you
            have a good-faith belief it was removed by mistake or misidentification; your name, address and phone number; and a
            statement that you agree to the jurisdiction of the court in your area and will accept service of process from the person
            who sent the original notice.
          </p>
          <p>
            Where the law allows, we may restore the material if the original sender does not tell us within 10 to 14 business days
            that they have started a court action.
          </p>
        </Section>

        <Section title="Repeat infringers">
          <p>
            In appropriate circumstances we will disable or terminate the accounts of users who are repeat infringers of copyright.
          </p>
        </Section>

        <Section title="False claims">
          <p>
            Under section 512(f) of the DMCA, anyone who knowingly makes a materially false statement that material is infringing, or
            that it was removed by mistake, may be liable for damages. Please make sure your notice is accurate before sending it.
          </p>
        </Section>

        <Section title="Other copyright questions">
          <p>
            For anything that is not a takedown notice you can reach us through the <b>Contact us</b> page. Please do not send takedown
            notices there. Use the email address above so we can handle them quickly.
          </p>
        </Section>
      </div>
    </div>
  );
}
