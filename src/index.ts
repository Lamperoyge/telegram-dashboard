import dotenv from 'dotenv';
import { Markup, Telegraf } from 'telegraf';
import { Client } from '@notionhq/client';
import cron from 'node-cron';

dotenv.config();

const cronSchedule = '30 9 * * *';

const botToken: string = process.env.BOT_TOKEN || '';

const DATABASE_ID = process.env.DATABASE_ID || '';

const DAYS = {
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
}
const notion = new Client({
  auth: process.env.NOTION_SECRET,
});

async function queryActions() {
  try {
    const response: any = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        and: [
          {
            property: 'Done',
            checkbox: {
              equals: false,
            },
          },
          {
            property: 'Action Tags',
            select: {
              equals: 'Action',
            },
          },
          {
            property: 'Delegated To',
            rich_text: {
              is_empty: true,
            },
          },
          {
            property: 'Horizon',
            select: {
              equals: 'Immediate',
            },
          },
          {
            or: [
              {
                property: '⚠Depends on',
                relation: {
                  is_empty: true,
                },
              },
              {
                property: 'Blocked?',
                rollup: {
                  any: {
                    rich_text: {
                      equals: '0',
                    },
                  },
                },
              },
              {
                property: 'Scheduled',
                date: {
                  is_empty: true,
                },
              },
              {
                property: 'Scheduled',
                date: {
                  equals: new Date().toISOString(),
                },
              },
            ],
          },
        ],
      },
    });
    const pages = response.results
      .map((page: any) => ({
        id: page.id,
        url: page.url,
      }))
      .reverse();

    const titles = await Promise.all(
      pages.map(async (page: any) => {
        const res: any = await notion.blocks.retrieve({
          block_id: page.id,
        });
        return {
          url: page.url,
          title: res?.child_page?.title,
        };
      })
    );
    return titles;
  } catch (error: any) {
    console.log(error);
    return [];
  }
}

async function addToNotion(message) {
  try {
    const page = await notion.pages.create({
      parent: {
        type: 'database_id',
        database_id: DATABASE_ID,
      },
      properties: {
        title: {
          title: [
            {
              text: {
                content: message,
              },
            },
          ],
        },
        Horizon: {
          select: {
            name: 'Immediate',
          },
        },
      },
    });
    return page;
  } catch (error) {
    console.log(Error);
  }
}

async function queryUnsorted() {
  try {
    const response: any = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        and: [
          {
            property: 'Action Tags',
            select: {
              is_empty: true,
            },
          },
          {
            property: 'Horizon',
            select: {
              equals: 'Immediate',
            },
          },
          {
            property: 'Done',
            checkbox: {
              equals: false,
            },
          },
        ],
      },
    });
    const pages = response.results
      .map((page: any) => ({
        id: page.id,
        url: page.url,
      }))
      .reverse();

    const titles = await Promise.all(
      pages.map(async (page: any) => {
        const res: any = await notion.blocks.retrieve({
          block_id: page.id,
        });
        return {
          url: page.url,
          title: res?.child_page?.title,
        };
      })
    );
    return titles;
  } catch (error) {
    return [];
  }
}

async function queryStuffToSort() {
  try {
    const response: any = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        and: [
          {
            property: 'Action Tags',
            select: {
              is_empty: true,
            },
          },
          {
            property: 'Horizon',
            select: {
              equals: 'Immediate',
            },
          },
          {
            property: 'Done',
            checkbox: {
              equals: false,
            },
          },
        ],
      },
    });
    const pages = response.results
      .map((page: any) => ({
        id: page.id,
        url: page.url,
      }))
      .reverse();

    const titles = await Promise.all(
      pages.map(async (page: any) => {
        const res: any = await notion.blocks.retrieve({
          block_id: page.id,
        });
        return {
          url: page.url,
          title: res?.child_page?.title,
        };
      })
    );
    return titles;
  } catch (error) {
    return [];
  }
}

const bot = new Telegraf(botToken);

bot.start(async (ctx) => {
  if (ctx.message.from.id !== 476826539) {
    ctx.reply('Unauthorized');
    bot.stop();
  }
  ctx.reply(
    'Hey Adrian! This is your Notion bot. Start with <code>/menu</code>',
    {
      parse_mode: 'HTML',
    }
  );
});

bot.command('/menu', (ctx) => {
  ctx.reply(
    'Choose',
    Markup.inlineKeyboard([
      [
        Markup.button.callback('Current actions', '/live'),
        Markup.button.callback('New entry', '/new_entry'),
      ],
      [
        Markup.button.callback('Unsorted', '/unsorted'),
        Markup.button.callback('Stuff to sort', '/stuff_to_sort'),
      ],
      [Markup.button.callback('My commands', '/commands')],
    ])
  );
});

bot.command('/ping', (ctx) => {
  ctx.reply('pong');
});

const handleActions = async (ctx) => {
  ctx.reply('Loading...');
  const titles: any = await queryActions();
  ctx.reply(
    `
      <b>Live Actions</b>\n\n${titles
        .map((title: any) => `<a href="${title.url}">${title.title}</a>\n`)
        .join('\n')}
    `,
    {
      parse_mode: 'HTML',
    }
  );
};

bot.action(/new_entry:(.*)/, async (ctx) => {
  const message = ctx.match[1];
  const page: any = await addToNotion(message);
  ctx.reply(`Added: <a href="${page?.url}">${message}</a>`, {
    parse_mode: 'HTML',
  });
});

bot.action('/cancel', (ctx) => {
  ctx.reply('Cancelled');
});

bot.command('/stuff', async (ctx) => {
  ctx.reply('Loading...');
  const titles: any = await queryUnsorted();
  ctx.reply(
    `
        <b>Inbox stuff</b>\n\n${titles
          .map((title: any) => `<a href="${title.url}">${title.title}</a>\n`)
          .join('\n')}
      `,
    {
      parse_mode: 'HTML',
    }
  );
});

bot.command('/to_sort', async (ctx) => {
  ctx.reply('Loading...');
  const titles: any = await queryStuffToSort();
  ctx.reply(
    `
        <b>Stuff to sort</b>\n\n${titles
          .map((title: any) => `<a href="${title.url}">${title.title}</a>\n`)
          .join('\n')}
        `,
    {
      parse_mode: 'HTML',
    }
  );
});

bot.action('/unsorted', async (ctx) => {
  ctx.reply('Loading...');
  const titles: any = await queryUnsorted();
  ctx.reply(
    `
          <b>Inbox stuff</b>\n\n${titles
            .map((title: any) => `<a href="${title.url}">${title.title}</a>\n`)
            .join('\n')}
        `,
    {
      parse_mode: 'HTML',
    }
  );
});

bot.action('/stuff_to_sort', async (ctx) => {
  ctx.reply('Loading...');
  const titles: any = await queryStuffToSort();
  ctx.reply(
    `
          <b>Stuff to sort</b>\n\n${titles
            .map((title: any) => `<a href="${title.url}">${title.title}</a>\n`)
            .join('\n')}
          `,
    {
      parse_mode: 'HTML',
    }
  );
});

bot.action('/live', async (ctx) => await handleActions(ctx));

bot.command('/live', async (ctx) => await handleActions(ctx));

bot.action('/commands', (ctx) => {
  bot.telegram.getMyCommands().then((commands) => {
    ctx.reply(
      commands
        .map((command) => {
          return `/${command.command} - ${command.description}`;
        })
        .join('\n')
    );
  });
});
bot.on('message', (ctx: any) => {
  const message = ctx.message?.text;
  ctx.reply(`<b>Add this to your Notion: ${message}</b>`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      Markup.button.callback('Add', `new_entry:${message}`),
      Markup.button.callback('Cancel', '/cancel'),
    ]),
  });
});

const sendGmMessage = async () => {
  console.log('Im starting to run');
  const titles: any = await queryActions();
  const text = `<b>Live Actions</b>\n\n${titles
        .map((title: any) => `<a href="${title.url}">${title.title}</a>\n`)
        .join('\n')}`;

    const today = new Date().getDay()
  bot.telegram.sendMessage(
    476826539,
    `Hey! Today is <b>${DAYS[today]}</b>, <b>${new Date().toLocaleDateString()}</b>\n\n<b>Here are you tasks for today:</b>\n\n${text}`,
    {
      parse_mode: 'HTML',
    }
  );
};

cron.schedule(cronSchedule, sendGmMessage, {
  scheduled: true,
  timezone: 'Europe/Bucharest',
});

bot.launch();
