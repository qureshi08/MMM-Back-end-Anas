import { nameForGroup, suggestChannelGroups } from './suggest-channel-combinations';

describe('suggestChannelGroups', () => {
  it('groups two real columns that move together almost perfectly', () => {
    const rows = [
      { tv_spend: 100, paid_social_spend: 200, paid_search_spend: 900 },
      { tv_spend: 200, paid_social_spend: 400, paid_search_spend: 100 },
      { tv_spend: 300, paid_social_spend: 600, paid_search_spend: 700 },
      { tv_spend: 400, paid_social_spend: 800, paid_search_spend: 200 },
    ];
    const groups = suggestChannelGroups(rows, ['tv_spend', 'paid_social_spend', 'paid_search_spend']);
    expect(groups).toEqual([['tv_spend', 'paid_social_spend']]);
  });

  it('chains three columns into one group when A-B and B-C both qualify', () => {
    const rows = [
      { a: 1, b: 2, c: 2 },
      { a: 2, b: 4, c: 4 },
      { a: 3, b: 6, c: 6 },
      { a: 4, b: 8, c: 8 },
    ];
    const groups = suggestChannelGroups(rows, ['a', 'b', 'c']);
    expect(groups).toEqual([['a', 'b', 'c']]);
  });

  it('finds nothing when no real columns are highly correlated', () => {
    const rows = [
      { a: 1, b: 9, c: 4 },
      { a: 2, b: 3, c: 1 },
      { a: 3, b: 7, c: 8 },
      { a: 4, b: 1, c: 2 },
    ];
    expect(suggestChannelGroups(rows, ['a', 'b', 'c'])).toEqual([]);
  });
});

describe('nameForGroup', () => {
  it('joins the first word of each source column', () => {
    expect(nameForGroup(['tv_spend', 'paid_social_spend'])).toBe('tv_paid_combined');
  });
});
