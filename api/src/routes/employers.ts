import type { Router } from '../http/router.ts';
import { badRequest, notFound } from '../http/errors.ts';
import type { EmployerRepository } from '../repositories/employerRepository.ts';
import type { MemberRepository } from '../repositories/memberRepository.ts';
import type { ContributionRepository } from '../repositories/contributionRepository.ts';
import { aggregateYearlyContributions } from '../domain/pension.ts';

export interface EmployerRouteDeps {
  employers: EmployerRepository;
  members: MemberRepository;
  contributions: ContributionRepository;
}

export function registerEmployerRoutes(router: Router, deps: EmployerRouteDeps): void {
  router.get('/api/employers', () => ({ body: deps.employers.list() }));

  router.get('/api/employers/:id', ({ params }) => {
    const employer = deps.employers.findById(params.id);
    if (!employer) throw notFound(`Employer ${params.id}`);
    const memberCount = deps.members.list({ employerId: employer.id }).length;
    return { body: { ...employer, memberCount } };
  });

  router.get('/api/employers/:id/contributions', ({ params, query }) => {
    const yearStr = query.get('year');
    if (!yearStr) throw badRequest('year is required');

    // Validate that yearStr is a complete valid integer string (no extra characters like abc or .5)
    if (!/^\d+$/.test(yearStr)) {
      throw badRequest('year must be a valid integer');
    }

    const year = Number.parseInt(yearStr, 10);

    const employer = deps.employers.findById(params.id);
    if (!employer) throw notFound(`Employer ${params.id}`);

    const contributions = deps.contributions.listByEmployerAndYear(params.id, year);
    const summary = aggregateYearlyContributions(contributions, year);
    return { body: summary };
  });
}
