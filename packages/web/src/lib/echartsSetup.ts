import { use } from 'echarts/core'
import { BarChart, CustomChart, LineChart, ScatterChart } from 'echarts/charts'
import { DataZoomComponent, GridComponent, MarkLineComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([BarChart, CustomChart, LineChart, ScatterChart, DataZoomComponent, GridComponent, MarkLineComponent, TooltipComponent, CanvasRenderer])
