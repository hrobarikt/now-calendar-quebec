export default {
	getTemplates: async function (e = [], n) {
		return (
			await Object(o.g)(e.map(p)),
			e.reduce((e, n) => ((e[n] = t.get(n)), e), {})
		);
	},
	getComponentsByTagNames: async function _(e = [], t = u) {
		return await d([], e, t);
	},
};
