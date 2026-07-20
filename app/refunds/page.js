import PolicyPage from '../components/PolicyPage';

export const metadata = {
  title: 'Refunds and Cancellations | Stories by Ami',
  description: 'Refund, cancellation, and replacement policies for Stories by Ami.'
};

export default function RefundsPage() {
  return (
    <PolicyPage
      kicker="Purchases"
      title="Refunds and Cancellations"
      intro="Because AMI products are personalized, refund eligibility depends on whether generation, approval, or physical production has begun."
    >
      <section>
        <h2>Digital stories</h2>
        <p>Digital stories are created from your custom information. Once generation has successfully started or a completed story has been delivered, purchases are generally nonrefundable. Contact us if a confirmed technical problem prevents generation or access and we will first attempt to restore the credit, regenerate the story, or correct the delivery issue.</p>
      </section>

      <section>
        <h2>Memberships</h2>
        <p>You may cancel a membership at any time through the billing portal once billing is active. Cancellation prevents the next renewal. We generally do not provide prorated refunds for partially used billing periods or unused credits, except where required by law or when a duplicate or incorrect charge is confirmed.</p>
      </section>

      <section>
        <h2>Printed personalized books</h2>
        <p>Printed books are made specifically for you and generally cannot be returned for preference changes, approved spelling or content, or a change of mind. Before production, please review the digital proof carefully.</p>
        <p>If you contact us before an order enters production, we will make reasonable efforts to cancel or correct it. Once a printer accepts the order, cancellation or changes may not be possible.</p>
      </section>

      <section>
        <h2>Damaged, defective, or incorrect items</h2>
        <p>Contact <a href="mailto:support@storiesbyami.com">support@storiesbyami.com</a> within 14 days of delivery with your order number and clear photos of the book and packaging. When the printer confirms a manufacturing defect, transit damage, or fulfillment error, we may arrange a replacement or other appropriate resolution.</p>
      </section>

      <section>
        <h2>Address errors and missed deliveries</h2>
        <p>Customers are responsible for entering a complete and accurate shipping address. Reprints or reshipments caused by an incorrect customer-provided address, refusal, or unclaimed package may require additional printing and shipping payment.</p>
      </section>

      <section>
        <h2>AMI Studio projects</h2>
        <p>Human-created Studio work may include nonrefundable creative or production fees once work begins. Any included revision limit, proof deadline, deposit, and cancellation terms will be stated in the applicable listing, invoice, or order confirmation.</p>
      </section>
    </PolicyPage>
  );
}
