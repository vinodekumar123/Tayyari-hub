"use client";

import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Back Button */}
      <Button
        variant="outline"
        onClick={() => router.back()}
        className="mb-6 flex items-center gap-2 rounded-xl shadow-sm"
      >
        <ArrowLeft size={18} />
        Back
      </Button>

      <Card className="shadow-xl rounded-2xl border border-gray-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-3xl font-bold text-center text-gray-800">
            Privacy Policy
          </CardTitle>
          <p className="text-sm text-gray-500 text-center">
            Effective Date: [Insert Date]
          </p>
        </CardHeader>

        <CardContent className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-2 text-gray-800">
              1. Payments & Refunds
            </h2>
            <p>
              - All fees are <strong>refundable</strong>. <br />
              - Fees must be deposited <strong>only</strong> into our officially
              mentioned account. <br />
              - My Tayyari Hub is <strong>not responsible</strong> for any
              payments made to third parties. <br />
              - Demo tests are available. Please try them before enrolling in{" "}
              <strong>Tayyari Hub Premium or Paid Plans</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2 text-gray-800">
              2. Official Communication
            </h2>
            <p>
              - Our official customer care number is:{" "}
              <strong>+92 323 7507673</strong>. <br />
              - Any communication from other numbers, emails, or platforms
              should be considered <strong>fake and unauthentic</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2 text-gray-800">
              3. Information We Collect
            </h2>
            <p>
              - Basic details you provide at the time of enrollment (such as
              name, email, or any identifier you choose). <br />
              - Test results, premium plan records, and enrollment details.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2 text-gray-800">
              4. How We Use Your Information
            </h2>
            <p>
              - To manage your enrollment and provide premium services. <br />
              - To identify your account for test results and premium access.{" "}
              <br />
              - To send <strong>Tayyari Hub–related updates</strong> or
              promotional emails (you can unsubscribe anytime through the email
              itself).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2 text-gray-800">
              5. Data Accuracy & Flexibility
            </h2>
            <p>
              - You are <strong>not required</strong> to provide fully accurate
              personal information. <br />
              - You may use any name or data you feel comfortable with, as long
              as it allows us to identify your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2 text-gray-800">
              6. Data Sharing & Security
            </h2>
            <p>
              - We <strong>do not sell, share, or rent</strong> your personal
              data to any third party. <br />
              - Data is stored only for identification and enrollment purposes.{" "}
              <br />
              - Reasonable safeguards are used to protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2 text-gray-800">
              7. Your Choices
            </h2>
            <p>
              - You may request to unsubscribe from promotional emails at any
              time. <br />
              - You may contact customer care if you have any concerns about
              your data or transactions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2 text-gray-800">
              8. Contact Us
            </h2>
            <p>
              For any questions regarding this Privacy Policy or your data,
              please contact us: <br />
              📞 <strong>+92 323 7507673</strong>
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
