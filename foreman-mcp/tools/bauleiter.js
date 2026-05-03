import { runForemanBuild } from '../lib/runner.js';

const TRACK_TEMPLATES = {
  fullstack: ['backend-api', 'frontend-ui', 'tests', 'docs'],
  api_only: ['api-endpoints', 'api-tests', 'api-docs'],
  frontend_only: ['ui-components', 'ui-pages', 'ui-tests']
};

export const tool = {
  name: 'bauleiter.plan',
  description: 'Manager-of-Foremans: decompose a large epic into multiple parallel Foreman tracks using a track template. Returns a plan; if auto_dispatch is true, also dispatches all tracks via foreman.dispatch immediately.',
  inputSchema: {
    type: 'object',
    required: ['epic_description'],
    properties: {
      epic_description: {
        type: 'string',
        description: 'High-level project goal (e.g. \'Build a URL shortener with analytics dashboard\')'
      },
      template: {
        type: 'string',
        enum: ['fullstack', 'api_only', 'frontend_only'],
        default: 'fullstack',
        description: 'Track template determining how the epic is decomposed'
      },
      max_coins_per_worker: {
        type: 'number',
        default: 3,
        minimum: 1,
        maximum: 10
      },
      auto_dispatch: {
        type: 'boolean',
        default: false,
        description: 'If true, immediately dispatch all tracks via Foreman after planning. If false, only return the plan for review.'
      }
    }
  },
  handler: async (args) => {
    try {
      const template = args.template || 'fullstack';
      
      // Validate template
      if (!TRACK_TEMPLATES[template]) {
        return {
          content: [{
            type: 'text',
            text: `Error: Invalid template '${template}'. Valid templates: ${Object.keys(TRACK_TEMPLATES).join(', ')}`
          }],
          isError: true
        };
      }

      const trackIds = TRACK_TEMPLATES[template];
      const tracks = trackIds.map(id => ({
        id,
        role: id.replace(/-/g, ' ')
      }));

      const plan = {
        epic: args.epic_description,
        template,
        tracks,
        total_workers: tracks.length,
        estimated_max_coins: tracks.length * (args.max_coins_per_worker || 3)
      };

      // Auto-dispatch path
      if (args.auto_dispatch) {
        const result = runForemanBuild({
          projectDescription: args.epic_description,
          taskIds: trackIds,
          maxCoinsPerWorker: args.max_coins_per_worker || 3
        });

        const trackList = trackIds.map(id => `- ${id}`).join('\n');
        
        return {
          content: [{
            type: 'text',
            text: `Bauleiter dispatched ${tracks.length} parallel tracks for: ${args.epic_description}\n\nTracks:\n${trackList}\n\nJob ID: ${result.job_id}\nDashboard: ${result.dashboard_url}\nStarted: ${result.started_at}\n\nUse foreman.status to poll progress.`
          }]
        };
      }

      // Plan-only path
      return {
        content: [{
          type: 'text',
          text: `Bauleiter plan ready (NOT yet dispatched):\n\n${JSON.stringify(plan, null, 2)}\n\nIMPORTANT: Each track in tracks[] requires a corresponding .foreman-prompts/<track_id>.txt brief file before dispatch will succeed. To execute: call bauleiter.plan again with auto_dispatch=true OR call foreman.dispatch with the listed task_ids.`
        }]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true
      };
    }
  }
};
