import PolicyPage from '../components/PolicyPage';

export const metadata = {
  title: 'Shipping and Printed Books | Stories by Ami',
  description: 'Printing, production, shipping, tracking, and replacement information for Stories by Ami books.'
};

export default function ShippingPage() {
  return (
    <PolicyPage
      kicker="Printed keepsakes"
      title="Shipping and Printed Books"
      intro="Printed AMI books are produced on demand after the final version is approved and payment is complete."
    >
      <section>
        <h2>Production</h2>
        <p>Printed books are produced by a third-party printing and fulfillment partner. Production time begins after the final files are approved and the order is accepted by the printer. Estimated timelines shown at checkout are not guaranteed and may change during holidays, high-volume periods, or carrier disruptions.</p>
      </section>

      <section>
        <h2>Shipping charges</h2>
        <p>Shipping is generally charged separately from the book price. Available services, delivery estimates, and charges depend on the destination, book format, quantity, and fulfillment provider.</p>
      </section>

      <section>
        <h2>Tracking</h2>
        <p>When tracking is available, it will be sent to the email address used for the order. Carrier scans may take time to update after a label is created.</p>
      </section>

      <section>
        <h2>Addresses</h2>
        <p>Please review the recipient name, street address, apartment or unit, city, state, postal code, and country before approving the order. Contact us immediately if you notice an error. We cannot guarantee changes after production begins.</p>
      </section>

      <section>
        <h2>International orders</h2>
        <p>International availability may be limited. The recipient may be responsible for customs duties, import taxes, brokerage charges, or local fees that are not included in the checkout total unless expressly stated.</p>
      </section>

      <section>
        <h2>Damage or printing defects</h2>
        <p>Inspect the book promptly after delivery. For damage, binding problems, missing pages, severe print defects, or receipt of the wrong item, email <a href="mailto:support@storiesbyami.com">support@storiesbyami.com</a> within 14 days and include photos of the book, packaging, and shipping label.</p>
      </section>

      <section>
        <h2>Lost or delayed packages</h2>
        <p>If tracking has not updated or the package appears lost, contact us after the carrier’s estimated delivery window. We will review the tracking and work with the fulfillment provider. Replacement eligibility depends on the carrier and printer investigation.</p>
      </section>
    </PolicyPage>
  );
}
