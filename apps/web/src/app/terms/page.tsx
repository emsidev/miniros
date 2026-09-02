import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing use of MINIROS retail operations software.",
};

const lastUpdated = "September 2, 2026";

export default function TermsPage() {
  return (
    <LegalPageShell
      eyebrow="Legal"
      title="Terms of Service"
      lastUpdated={lastUpdated}
    >
      <section>
        <p>
          These Terms of Service (the “Terms”) govern your use of MINIROS,
          including its website, applications, and related services (the
          “Service”). MINIROS is operated by Mc Joseph Agbanlog (“we,” “us,” or
          “our”). By creating an account or using the Service, you agree to
          these Terms.
        </p>
      </section>

      <section>
        <h2>1. Eligibility and authority</h2>
        <p>
          You must be at least 18 years old and able to enter into a binding
          agreement under applicable law. If you use MINIROS for a business or
          organization, you confirm that you are authorized to accept these
          Terms on its behalf.
        </p>
      </section>

      <section>
        <h2>2. The Service</h2>
        <p>
          MINIROS is a retail operations tool for pop-ups, booths, bazaars,
          kiosks, and small retail teams. It helps users record shifts, sales,
          inventory, production, costs, closeouts, and location profitability.
          The Service is not an accounting, tax, legal, payroll, banking, or
          payment-processing service, and you remain responsible for reviewing
          your records and decisions.
        </p>
      </section>

      <section>
        <h2>3. Accounts and access</h2>
        <ul>
          <li>
            Provide accurate, current account information and keep it updated.
          </li>
          <li>
            Keep your sign-in credentials secure and do not share them
            improperly.
          </li>
          <li>
            Promptly notify us if you suspect unauthorized access to your
            account.
          </li>
          <li>
            Account owners and authorized administrators are responsible for
            inviting, managing, and removing their team members.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Your business data</h2>
        <p>
          You retain ownership of the data you submit to MINIROS, including
          business, employee, product, inventory, sales, shift, and closeout
          information (“Business Data”). You grant us a limited right to host,
          process, transmit, back up, and display Business Data only as needed
          to operate, secure, support, and improve the Service.
        </p>
        <p>
          You are responsible for ensuring that you have the necessary rights,
          notices, and permissions to submit Business Data and to make it
          available to your authorized team members.
        </p>
      </section>

      <section>
        <h2>5. Acceptable use</h2>
        <p>You may not use the Service to:</p>
        <ul>
          <li>violate laws, regulations, or the rights of others;</li>
          <li>
            submit malicious code, interfere with the Service, or bypass
            security controls;
          </li>
          <li>access accounts, data, or systems without authorization;</li>
          <li>
            use the Service to store unlawful, deceptive, or infringing content;
            or
          </li>
          <li>
            resell, copy, reverse engineer, or exploit the Service except as
            permitted by law.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Third-party services</h2>
        <p>
          MINIROS may rely on third-party providers, including Google for
          optional sign-in and Supabase for authentication, database, and
          storage services. Your use of a third-party service is also subject to
          that provider’s terms and privacy practices. We are not responsible
          for third-party services that we do not control.
        </p>
      </section>

      <section>
        <h2>7. Suspension and termination</h2>
        <p>
          You may stop using MINIROS at any time. We may suspend or terminate
          access when reasonably necessary to protect the Service, comply with
          law, address a breach of these Terms, or prevent harm to users or
          others. Where practical, we will provide notice of a suspension or
          termination.
        </p>
      </section>

      <section>
        <h2>8. Disclaimers</h2>
        <p>
          The Service is provided on an “as is” and “as available” basis. To the
          fullest extent permitted by law, we disclaim warranties of
          merchantability, fitness for a particular purpose, non-infringement,
          availability, and accuracy. We do not guarantee that the Service will
          be uninterrupted, error-free, or suitable for every business need.
        </p>
      </section>

      <section>
        <h2>9. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, MINIROS and Mc Joseph Agbanlog
          will not be liable for indirect, incidental, special, consequential,
          exemplary, or punitive damages, or for lost profits, revenue, data,
          goodwill, or business opportunities arising from your use of the
          Service. Nothing in these Terms excludes liability that cannot be
          excluded under applicable law.
        </p>
      </section>

      <section>
        <h2>10. Changes to these Terms</h2>
        <p>
          We may update these Terms as the Service or applicable law changes. We
          will post the updated version here and revise the “Last updated” date.
          Continued use after an update takes effect means you accept the
          updated Terms.
        </p>
      </section>

      <section>
        <h2>11. Governing law</h2>
        <p>
          These Terms are governed by the laws of the Republic of the
          Philippines, without regard to conflict-of-law principles. Any dispute
          will be subject to the jurisdiction of the competent courts of the
          Philippines, unless applicable law requires otherwise.
        </p>
      </section>

      <section>
        <h2>12. Contact us</h2>
        <p>
          For questions about these Terms, contact Mc Joseph Agbanlog at{" "}
          <a href="mailto:mcagbanlog2002@gmail.com">mcagbanlog2002@gmail.com</a>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
