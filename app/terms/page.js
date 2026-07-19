import PolicyPage from '../components/PolicyPage';

export const metadata = {
  title: 'Terms of Service | Stories by Ami',
  description: 'Terms governing use of Stories by Ami digital stories, memberships, and printed books.'
};

export default function TermsPage() {
  return (
    <PolicyPage
      kicker="Terms"
      title="Terms of Service"
      intro="These terms govern your use of Stories by Ami, including digital stories, memberships, proofs, and printed products."
    >
      <section>
        <h2>Eligibility and adult responsibility</h2>
        <p>You must be at least 18 years old and able to enter into a binding agreement to create an account, purchase a product, or upload information about a child. You represent that you have permission to provide all names, photos, memories, and other content you submit.</p>
      </section>

      <section>
        <h2>Personalized content</h2>
        <p>Ami creates customized story text and illustrations from the information you provide. You are responsible for reviewing names, spelling, story details, translations, illustrations, and personalization before downloading, sharing, approving, or ordering a physical copy. AI-generated content may be imperfect, inconsistent, or unexpected.</p>
      </section>

      <section>
        <h2>Your submissions</h2>
        <p>You retain your rights in the photos, text, and personal materials you submit. You grant Stories by Ami a limited license to host, process, adapt, and transmit those materials as needed to generate, store, display, support, print, and deliver your requested products.</p>
        <p>You may not upload content that you do not have permission to use, that violates another person’s privacy or intellectual-property rights, or that is unlawful, exploitative, abusive, or unsafe.</p>
      </section>

      <section>
        <h2>Generated stories and permitted use</h2>
        <p>Once paid for or included through an active plan, completed stories are licensed to you for personal and family use, including reading, gifting, and printing through approved Ami workflows. You may not resell, mass distribute, sublicense, or commercially publish generated books without written permission.</p>
      </section>

      <section>
        <h2>Memberships and credits</h2>
        <p>Ami Membership is planned at $9.99 per month and includes two digital story credits per successful billing period, with unused credits rolling over up to a balance of four. Each successfully generated book uses one credit. Failed generations should not permanently consume a credit. Included regeneration limits and member print pricing may be displayed at checkout or on the Membership page.</p>
        <p>Memberships renew automatically until canceled. Cancellation stops future renewals but does not retroactively refund completed billing periods. Completed stories remain available subject to account and service availability. Final billing terms will be shown during Stripe checkout before payment.</p>
      </section>

      <section>
        <h2>Digital purchases</h2>
        <p>Digital products are personalized and delivered electronically. Once generation or delivery has begun, digital purchases are generally nonrefundable except where required by law or when a confirmed technical failure prevents delivery.</p>
      </section>

      <section>
        <h2>Printed books and proof approval</h2>
        <p>Printed products are made to order. Before production, you may be asked to approve a digital proof. Approval confirms that you reviewed the spelling, text, illustrations, personalization, and layout. After a print order enters production, changes and cancellations may no longer be possible.</p>
      </section>

      <section>
        <h2>Pricing, taxes, and shipping</h2>
        <p>Prices, discounts, printing costs, shipping charges, and availability may change. Applicable taxes and shipping are shown during checkout. Member discounts apply only while the membership is active and do not necessarily apply to Ami Studio services or custom manual work.</p>
      </section>

      <section>
        <h2>Service availability</h2>
        <p>We may modify, suspend, or discontinue features, generation models, pricing, plans, or production options. We do not guarantee uninterrupted service or that every generation will meet subjective creative expectations.</p>
      </section>

      <section>
        <h2>Disclaimers and limitation</h2>
        <p>Ami stories are creative products and are not medical, psychological, educational, or therapeutic advice. To the fullest extent permitted by law, the service is provided “as is,” and Stories by Ami is not liable for indirect, incidental, or consequential losses arising from use of the service.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Questions about these terms may be sent to <a href="mailto:support@storiesbyami.com">support@storiesbyami.com</a>.</p>
      </section>
    </PolicyPage>
  );
}
