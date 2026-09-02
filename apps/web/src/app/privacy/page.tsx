import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How MINIROS collects, uses, stores, and protects personal data.",
};

const lastUpdated = "September 2, 2026";

export default function PrivacyPage() {
  return (
    <LegalPageShell
      eyebrow="Legal"
      title="Privacy Policy"
      lastUpdated={lastUpdated}
    >
      <section>
        <p>
          This Privacy Policy explains how MINIROS, operated by Mc Joseph
          Agbanlog (“MINIROS,” “we,” “us,” or “our”), collects, uses, stores,
          shares, and protects personal data when you use our website,
          applications, and related services (the “Service”). It is intended to
          support the rights and protections provided by the Philippine Data
          Privacy Act of 2012 and other applicable laws.
        </p>
      </section>

      <section>
        <h2>1. Data we collect</h2>
        <h3>Account and profile information</h3>
        <p>
          When you create or use an account, we may collect your name, email
          address, profile image, authentication identifier, and any profile
          details you choose to provide, such as a phone number.
        </p>

        <h3>Google sign-in information</h3>
        <p>
          If you choose “Continue with Google,” MINIROS receives basic Google
          Account profile information: your Google account identifier, name,
          email address, and profile image. We use this information solely to
          authenticate you and create or maintain your MINIROS account.
        </p>
        <p>
          MINIROS does not request, access, read, or store your Gmail, Google
          Drive, Google Contacts, Calendar, or other unrelated Google data. We
          do not sell Google user data or use it for advertising. Our use of
          Google user data is limited to the practices described here and is in
          accordance with the Google API Services User Data Policy, including
          the Limited Use requirements.
        </p>

        <h3>Business and operational information</h3>
        <p>
          We process the information you or your authorized team members enter
          into the Service. This may include business and employee details,
          selling-location information, products, recipes, inventory,
          production, shift assignments, sales, discounts, payment references,
          payment-proof images, costs, closeouts, profitability records, and
          related notes.
        </p>

        <h3>Technical and offline information</h3>
        <p>
          We and our service providers may process authentication cookies,
          device and browser information, IP address, security and error logs,
          and timestamps. When you use offline functionality, pending
          operational actions may be stored in your browser storage until they
          can be synchronized with MINIROS.
        </p>
      </section>

      <section>
        <h2>2. How we use data</h2>
        <ul>
          <li>Provide, operate, maintain, and secure the Service.</li>
          <li>
            Authenticate users, manage accounts, and provide customer support.
          </li>
          <li>
            Process Business Data and present operational and profitability
            insights.
          </li>
          <li>
            Enable authorized team members to collaborate within a business
            workspace.
          </li>
          <li>
            Prevent fraud, misuse, unauthorized access, and technical failures.
          </li>
          <li>
            Comply with legal obligations and enforce our Terms of Service.
          </li>
          <li>
            Improve the Service using aggregated or de-identified information
            where practical.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Legal basis for processing</h2>
        <p>
          We process personal data as needed to provide the Service you request,
          to pursue legitimate interests such as service security and
          improvement, to comply with legal obligations, and—with your consent
          where required—for optional activities such as Google sign-in.
        </p>
      </section>

      <section>
        <h2>4. How we share data</h2>
        <p>We do not sell personal data. We may share data only as follows:</p>
        <ul>
          <li>
            <strong>Authorized business users.</strong> Workspace owners,
            administrators, and team members can view information that their
            role permits them to access.
          </li>
          <li>
            <strong>Service providers.</strong> We use Supabase for
            authentication, database, and private storage services, along with
            infrastructure providers that help us operate and secure MINIROS.
          </li>
          <li>
            <strong>Google.</strong> Google processes sign-in under its own
            privacy policy when you choose Google authentication.
          </li>
          <li>
            <strong>Legal and safety reasons.</strong> We may disclose data when
            required by law or when reasonably necessary to protect users,
            MINIROS, or the public.
          </li>
          <li>
            <strong>Business transition.</strong> If MINIROS is involved in a
            merger, acquisition, or asset transfer, data may be transferred as
            part of that transaction, subject to appropriate safeguards.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. International processing</h2>
        <p>
          Our service providers may process or store information outside the
          Philippines. When this happens, we take reasonable steps to use
          providers and safeguards appropriate to the nature of the data and
          applicable law.
        </p>
      </section>

      <section>
        <h2>6. Security</h2>
        <p>
          We use reasonable administrative, technical, and organizational
          measures to protect data, including authenticated access controls,
          role-based workspace access, encrypted connections, and private
          storage for sensitive payment-proof files. No method of transmission
          or storage is completely secure, so we cannot guarantee absolute
          security.
        </p>
      </section>

      <section>
        <h2>7. Retention and deletion</h2>
        <p>
          We retain personal and Business Data while your account or workspace
          remains active and for as long as reasonably necessary to provide the
          Service, resolve disputes, meet legal obligations, and maintain
          security records. Some information may remain in backups for a limited
          period before being deleted or overwritten.
        </p>
        <p>
          You may request deletion of your account or personal data by emailing{" "}
          <a href="mailto:mcagbanlog2002@gmail.com">mcagbanlog2002@gmail.com</a>
          . We may need to verify your identity and may retain limited
          information when legally required or necessary for security and fraud
          prevention.
        </p>
      </section>

      <section>
        <h2>8. Your privacy rights</h2>
        <p>
          Subject to applicable law, you may request access to, correction of,
          deletion of, or information about the processing of your personal
          data. You may also withdraw consent where processing relies on
          consent. To exercise these rights or raise a privacy concern, contact
          us at the email below. You may have the right to lodge a complaint
          with the National Privacy Commission of the Philippines.
        </p>
      </section>

      <section>
        <h2>9. Children’s privacy</h2>
        <p>
          MINIROS is not directed to children. Do not use the Service if you are
          under 18, and do not submit personal data about a child unless you are
          authorized to do so and applicable law permits it.
        </p>
      </section>

      <section>
        <h2>10. Changes to this Privacy Policy</h2>
        <p>
          We may update this Privacy Policy as our practices, the Service, or
          applicable law changes. We will post the revised policy here and
          update the “Last updated” date.
        </p>
      </section>

      <section>
        <h2>11. Contact us</h2>
        <p>
          For privacy requests or questions about this policy, contact Mc Joseph
          Agbanlog at{" "}
          <a href="mailto:mcagbanlog2002@gmail.com">mcagbanlog2002@gmail.com</a>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
