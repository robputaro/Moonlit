import PolicyPage from '../components/PolicyPage';

export const metadata = {
  title: 'Privacy Policy | Stories by Ami',
  description: 'How Stories by Ami collects, uses, stores, and protects information.'
};

export default function PrivacyPage() {
  return (
    <PolicyPage
      kicker="Privacy"
      title="Privacy Policy"
      intro="Stories by Ami creates personalized stories for families. This policy explains what information we collect, why we use it, and the choices available to you."
    >
      <section>
        <h2>Who this service is for</h2>
        <p>Stories by Ami is intended for parents, guardians, grandparents, and other adults creating stories for children. Adults should submit only information and photos they have permission to use. Children should not create accounts or submit personal information directly.</p>
      </section>

      <section>
        <h2>Information we collect</h2>
        <p>Depending on how you use AMI, we may collect:</p>
        <ul>
          <li>Account information, such as your name, email address, and login details.</li>
          <li>Story details you provide, including a child’s first name or nickname, age, interests, appearance notes, family details, pets, dedication text, and story preferences.</li>
          <li>Optional reference photos uploaded to personalize an illustrated character.</li>
          <li>Generated story text, illustrations, saved books, edits, and print files.</li>
          <li>Purchase, subscription, billing-status, order, shipping, and support information.</li>
          <li>Technical information such as browser type, device information, IP address, and basic usage logs.</li>
        </ul>
        <p>Please do not submit sensitive information that is unnecessary for creating the story, including a child’s full legal name, school, home address, medical records, or other highly private details.</p>
      </section>

      <section>
        <h2>How we use information</h2>
        <ul>
          <li>To generate, illustrate, save, edit, and display personalized stories.</li>
          <li>To analyze an optional reference photo and create a stylized character inspired by it.</li>
          <li>To provide digital downloads, reader access, memberships, credits, proofs, printing, shipping, and customer support.</li>
          <li>To prevent abuse, troubleshoot errors, secure accounts, and improve the service.</li>
          <li>To send necessary account, billing, proof, order, and service communications.</li>
        </ul>
      </section>

      <section>
        <h2>AI-assisted creation</h2>
        <p>AMI uses third-party artificial-intelligence services to help generate and analyze story content and illustrations. Information included in a story request, including an optional reference photo or appearance description, may be transmitted to those providers solely to perform the requested generation. AI-generated text and images may contain mistakes or inconsistencies, so adults should review every page before sharing or ordering a printed copy.</p>
      </section>

      <section>
        <h2>Service providers</h2>
        <p>We use service providers to operate AMI, including hosting, authentication, storage, analytics, AI generation, payment processing, email, printing, and fulfillment. These providers may process information on our behalf according to their own terms and privacy practices. Current providers may include Vercel, Supabase, Google, Anthropic, OpenAI, Stripe, and Lulu.</p>
      </section>

      <section>
        <h2>Child photos and story content</h2>
        <p>Reference photos are optional. We use them to personalize illustrations and store them in access-controlled storage associated with the story or account. You may remove a photo before generation or contact us to request deletion of stored reference photos and associated story data. We do not sell child photos or story details to advertisers.</p>
      </section>

      <section>
        <h2>Storage and retention</h2>
        <p>We retain account information and saved stories while your account remains active or as needed to provide the service. Order, payment, tax, fraud-prevention, and support records may be retained longer when reasonably necessary. You may request deletion of your account and eligible story data by contacting us.</p>
      </section>

      <section>
        <h2>Your choices</h2>
        <ul>
          <li>Edit or delete saved stories from your account where those controls are available.</li>
          <li>Remove or replace optional reference photos.</li>
          <li>Cancel a membership through the billing portal once billing is live.</li>
          <li>Request access, correction, or deletion by emailing support.</li>
        </ul>
      </section>

      <section>
        <h2>Security</h2>
        <p>We use reasonable administrative and technical safeguards, including authenticated accounts and access-controlled storage. No internet service can guarantee absolute security. Use a unique password and contact us promptly if you believe your account has been compromised.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Questions or privacy requests may be sent to <a href="mailto:support@storiesbyami.com">support@storiesbyami.com</a>.</p>
      </section>
    </PolicyPage>
  );
}
