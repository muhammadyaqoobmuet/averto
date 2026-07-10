export const pricingPlans = [
    {
        id: 1,
        name: "Starter",
        price: {
            monthly: 25,
            yearly: 290
        },
        description: "Perfect for freelancers who want full control over their personal finances",
        features: [
            { text: "Track income & expenses", highlighted: false },
            { text: "Connect up to 2 accounts", highlighted: false },
            { text: "Monthly reports", highlighted: false },
            { text: "Smart alerts", highlighted: false },
            { text: "3 active projects", highlighted: false },
            { text: "Community Support", highlighted: false }
        ],
        cta: {
            text: "Get Starter",
            href: "#"
        },
        popular: false
    },
    {
        id: 2,
        name: "Pro",
        price: {
            monthly: 42,
            yearly: 490
        },
        description: "Advanced tools to manage your money smarter and unlock powerful insights",
        features: [
            { text: "Unlimited accounts", highlighted: true },
            { text: "AI spending insights", highlighted: true },
            { text: "Custom alerts", highlighted: true },
            { text: "Advanced reporting", highlighted: true },
            { text: "Unlimited projects", highlighted: true },
            { text: "24/7 priority support", highlighted: true }
        ],
        cta: {
            text: "Get Pro",
            href: "#"
        },
        popular: true,
        badge: "POPULAR",
        yearlyDiscount: "2 months free"
    }
];

export const trustedCompanies = {
    title: "Trusted by teams worldwide",
    description: "Invite your team, sync accounts in real time, and track shared goals with ease",
    cta: {
        text: "Talk to Sales",
        href: "#"
    }
};

