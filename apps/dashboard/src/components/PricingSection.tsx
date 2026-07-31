const plans = [
  {
    name: "Starter",
    price: "$0",
    period: "forever",
    description: "Perfect for individual developers exploring execution intelligence.",
    features: [
      "100 executions/month",
      "Basic analytics dashboard",
      "1 project",
      "Community support",
      "Standard dataset exports",
    ],
    cta: "Start Free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$49",
    period: "/month",
    description: "For growing teams building production AI systems.",
    features: [
      "10,000 executions/month",
      "Advanced analytics & cost tracking",
      "Unlimited projects",
      "Priority support",
      "Custom research agents",
      "API access & webhooks",
      "Parquet & Arrow exports",
    ],
    cta: "Start Pro Trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large organizations with complex AI governance needs.",
    features: [
      "Unlimited executions",
      "Custom analytics & reporting",
      "Dedicated support engineer",
      "SSO & RBAC",
      "On-premise deployment",
      "SLA guarantee",
      "Custom dataset pipelines",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 px-6 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="inline-block text-xs font-semibold text-[#4F46E5] bg-[#4F46E5]/10 px-3 py-1 rounded-full mb-4">
            PRICING
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-[#475569] max-w-2xl mx-auto">
            Start free, scale as you grow. No hidden fees.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative p-8 rounded-2xl border ${
                plan.highlighted
                  ? "border-[#4F46E5] bg-white shadow-xl ring-1 ring-[#4F46E5]/10"
                  : "border-[#E2E8F0] bg-white"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold text-white bg-[#4F46E5] px-4 py-1 rounded-full">
                  Most Popular
                </span>
              )}
              <h3 className="text-lg font-semibold text-[#0F172A] mb-2">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold text-[#0F172A]">{plan.price}</span>
                {plan.period && <span className="text-sm text-[#94A3B8]">{plan.period}</span>}
              </div>
              <p className="text-sm text-[#475569] mb-6">{plan.description}</p>
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-[#475569]">{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                className={`w-full py-3 rounded-lg text-sm font-semibold transition-colors ${
                  plan.highlighted
                    ? "bg-[#4F46E5] text-white hover:bg-[#4338CA]"
                    : "bg-[#F8FAFC] text-[#0F172A] border border-[#E2E8F0] hover:bg-[#F1F5F9]"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
